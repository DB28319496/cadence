// The state machine. `advanceRun` walks the pipeline from the first non-done
// step: auto steps run their handler and (on success) advance; manual steps and
// not-yet-implemented auto steps block the run for an operator. Handlers are
// idempotent — they persist external IDs / config so a retry never double-creates.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getStepDef,
  stepOrder,
  type RunStatus,
  type StepKey,
} from "@/lib/setup/pipeline";
import { STEP_HANDLERS } from "@/lib/steps";
import type { StepOutcome } from "@/lib/steps/types";
import { notifyOperator } from "@/lib/setup/notify";

const asJson = (v: unknown): Prisma.InputJsonValue =>
  (v ?? {}) as Prisma.InputJsonValue;

async function loadClient(clientId: string) {
  const client = await prisma.switchboardClient.findUnique({ where: { id: clientId } });
  if (!client) throw new Error(`SwitchboardClient ${clientId} not found`);
  return client;
}

async function setRun(runId: string, status: RunStatus, currentStep: string | null) {
  // Read prior state so we only notify the operator on a genuine transition
  // (a re-block at the same step on retry must not re-send).
  const before = await prisma.onboardingRun.findUnique({
    where: { id: runId },
    select: { status: true, currentStep: true, client: { select: { businessName: true } } },
  });

  const updated = await prisma.onboardingRun.update({
    where: { id: runId },
    data: {
      status,
      currentStep,
      ...(status === "live" ? { completedAt: new Date() } : {}),
    },
    include: { steps: true },
  });

  const changed = !before || before.status !== status || before.currentStep !== currentStep;
  if (changed && (status === "blocked" || status === "failed" || status === "live")) {
    // Fire-and-forget — must not block or fail the engine.
    void notifyOperator(status, {
      runId,
      businessName: before?.client.businessName ?? "Client",
      step: currentStep,
    });
  }

  return updated;
}

/**
 * Drive a run forward. Returns the run (with steps) in its resting state:
 * `blocked` (manual task or missing/no-go), `failed` (handler error), `live`
 * (all steps done), or `running` when `maxSteps` caps how many auto steps run in
 * this call. Safe to call repeatedly — it always recomputes from persisted state,
 * so it's both the resume entrypoint and (with maxSteps:1) the serverless-safe
 * one-step-per-request driver.
 */
export async function advanceRun(
  runId: string,
  opts: { maxSteps?: number } = {}
) {
  const maxSteps = opts.maxSteps ?? Number.MAX_SAFE_INTEGER;
  let executed = 0;

  // First touch: stamp startedAt and flip draft -> running.
  const initial = await prisma.onboardingRun.findUnique({ where: { id: runId } });
  if (!initial) throw new Error(`OnboardingRun ${runId} not found`);
  if (!initial.startedAt || initial.status === "draft") {
    await prisma.onboardingRun.update({
      where: { id: runId },
      data: { status: "running", startedAt: initial.startedAt ?? new Date() },
    });
  }

  // Bounded loop — at most one pass per pipeline step.
  for (let guard = 0; guard < 50; guard++) {
    const run = await prisma.onboardingRun.findUnique({
      where: { id: runId },
      include: { steps: true },
    });
    if (!run) throw new Error(`OnboardingRun ${runId} not found`);

    const ordered = [...run.steps].sort(
      (a, b) => stepOrder(a.key) - stepOrder(b.key)
    );
    const next = ordered.find((s) => s.status !== "done" && s.status !== "skipped");

    // Nothing left -> the run is live.
    if (!next) {
      const live = await setRun(runId, "live", null);
      await prisma.switchboardClient.update({
        where: { id: run.clientId },
        data: { status: "live" },
      });
      return live;
    }

    const def = getStepDef(next.key);
    if (!def) {
      await prisma.provisioningStep.update({
        where: { id: next.id },
        data: { status: "failed", result: asJson({ error: `Unknown step ${next.key}` }) },
      });
      return setRun(runId, "failed", next.key);
    }

    const handler = STEP_HANDLERS[next.key as StepKey];

    // Manual step -> block with task content for the operator.
    if (def.type === "manual") {
      // Anything other than a fresh `pending` is terminal for this pass:
      // `blocked` is waiting on the operator (keep submitted state, e.g. A2P
      // brandSid, intact), `failed` is a hard error. Don't rebuild either.
      if (next.status !== "pending") {
        return setRun(runId, next.status === "failed" ? "failed" : "blocked", next.key);
      }
      // First arrival (pending): build the task via the manual handler.
      let result: unknown = { task: def.description, label: def.label };
      if (handler) {
        const client = await loadClient(run.clientId);
        try {
          const outcome = await handler({ run, step: next, client, steps: ordered });
          result = outcome.result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await prisma.provisioningStep.update({
            where: { id: next.id },
            data: { status: "failed", result: asJson({ error: message }) },
          });
          return setRun(runId, "failed", next.key);
        }
      }
      await prisma.provisioningStep.update({
        where: { id: next.id },
        data: { status: "blocked", result: asJson(result) },
      });
      return setRun(runId, "blocked", next.key);
    }

    // Auto step with no handler (safety net) -> block cleanly, don't fake-complete.
    if (!handler) {
      await prisma.provisioningStep.update({
        where: { id: next.id },
        data: {
          status: "blocked",
          result: asJson({ note: `${def.label} is not implemented until Phase 2.` }),
        },
      });
      return setRun(runId, "blocked", next.key);
    }

    // Run the auto handler. Client is loaded fresh so it sees config/prompt
    // written by an earlier step in this same advance pass.
    const client = await loadClient(run.clientId);

    const running = await prisma.provisioningStep.update({
      where: { id: next.id },
      data: { status: "running", attempts: { increment: 1 } },
    });

    let outcome: StepOutcome;
    try {
      outcome = await handler({ run, step: running, client, steps: ordered });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.provisioningStep.update({
        where: { id: next.id },
        data: { status: "failed", result: asJson({ error: message }) },
      });
      return setRun(runId, "failed", next.key);
    }

    await prisma.provisioningStep.update({
      where: { id: next.id },
      data: { status: outcome.status, result: asJson(outcome.result) },
    });

    if (outcome.status === "done") {
      // Budget cap (serverless one-step-per-request): stop after N auto steps,
      // leaving the run `running` so the caller/poller drives the next one.
      if (++executed >= maxSteps) {
        return (await prisma.onboardingRun.findUnique({
          where: { id: runId },
          include: { steps: true },
        }))!;
      }
      continue; // advance to the next step
    }
    return setRun(runId, outcome.status === "failed" ? "failed" : "blocked", next.key);
  }

  throw new Error(`advanceRun(${runId}) exceeded step guard — possible cycle`);
}
