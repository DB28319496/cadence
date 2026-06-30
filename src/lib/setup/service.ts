// Operator-facing operations on runs: create from intake, retry a step, and
// edit intake + re-run the brain. Thin orchestration over Prisma + the engine.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { advanceRun } from "@/lib/engine";
import { PIPELINE, getStepDef, type StepKey } from "@/lib/setup/pipeline";
import { VERTICALS, switchboardConfigSchema, type Vertical } from "@/lib/setup/config-schema";
import { registerA2P, getA2PStatus } from "@/lib/integrations/twilio";
import { enqueueDelayed, qstashAvailable } from "@/lib/integrations/qstash";

const A2P_POLL_DELAY_SECONDS = 300;
const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");

export interface IntakeForm {
  businessName: string;
  vertical: Vertical;
  city?: string;
  hours?: string;
  services?: string;
  phone?: string;
  ownerPhone?: string;
}

export type CreateRunInput =
  | { mode: "paste"; text: string }
  | { mode: "form"; form: IntakeForm };

/** Turn a structured form into the same free-text the paste path feeds the LLM. */
function buildIntakeText(form: IntakeForm): string {
  const lines = [
    `Business name: ${form.businessName}`,
    `Vertical: ${form.vertical}`,
    form.city && `City: ${form.city}`,
    form.hours && `Hours: ${form.hours}`,
    form.services && `Services: ${form.services}`,
    form.phone && `Business phone: ${form.phone}`,
    form.ownerPhone && `Owner phone: ${form.ownerPhone}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export async function createRunFromIntake(
  input: CreateRunInput
): Promise<{ runId: string; clientId: string }> {
  let businessName: string;
  let vertical: Vertical;
  let intakeText: string;
  let intakeMode: "paste" | "form";

  if (input.mode === "form") {
    if (!VERTICALS.includes(input.form.vertical)) {
      throw new Error(`Invalid vertical: ${input.form.vertical}`);
    }
    businessName = input.form.businessName.trim() || "Untitled client";
    vertical = input.form.vertical;
    intakeText = buildIntakeText(input.form);
    intakeMode = "form";
  } else {
    // Paste mode: real businessName/vertical are derived by generate_config.
    businessName = "Untitled client";
    vertical = "auto";
    intakeText = input.text.trim();
    intakeMode = "paste";
    if (!intakeText) throw new Error("Pasted intake is empty.");
  }

  const client = await prisma.switchboardClient.create({
    data: { businessName, vertical },
  });

  const run = await prisma.onboardingRun.create({
    data: {
      clientId: client.id,
      status: "draft",
      steps: {
        create: PIPELINE.map((step) => {
          const base = {
            key: step.key,
            type: step.type,
            // Seed intake as already done, carrying the text the engine reads.
            status: step.key === "intake" ? "done" : "pending",
          };
          if (step.key !== "intake") return base;
          const result = {
            mode: intakeMode,
            intakeText,
            ...(input.mode === "form" ? { form: input.form } : {}),
          };
          return { ...base, result: result as unknown as Prisma.InputJsonValue };
        }),
      },
    },
  });

  await advanceRun(run.id);
  return { runId: run.id, clientId: client.id };
}

/** Reset one step to pending and drive the run again. Used for Run / Retry. */
export async function retryStep(runId: string, key: StepKey) {
  await prisma.provisioningStep.update({
    where: { runId_key: { runId, key } },
    data: { status: "pending", result: { retriedAt: new Date().toISOString() } },
  });
  return advanceRun(runId);
}

/** Operator marks a manual task done -> resume the run. */
export async function markStepDone(runId: string, key: StepKey) {
  const def = getStepDef(key);
  if (def?.type !== "manual") {
    throw new Error(`Step ${key} is not a manual task and can't be marked done.`);
  }
  const step = await prisma.provisioningStep.findUnique({
    where: { runId_key: { runId, key } },
  });
  if (!step) throw new Error(`Step ${key} not found on run ${runId}`);

  const prev = (step.result as Record<string, unknown> | null) ?? {};
  await prisma.provisioningStep.update({
    where: { runId_key: { runId, key } },
    data: {
      status: "done",
      result: { ...prev, markedDoneAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  });
  return advanceRun(runId);
}

/**
 * Submit the A2P brand + campaign (needs the client's EIN), persist the returned
 * SIDs, and kick off approval polling. The step stays blocked until approved.
 */
export async function submitA2P(
  runId: string,
  input: { ein: string; brand?: string; campaign?: string }
) {
  const ein = input.ein.trim();
  if (!ein) throw new Error("EIN is required to register A2P.");

  const run = await prisma.onboardingRun.findUnique({
    where: { id: runId },
    include: { client: true, steps: true },
  });
  if (!run) throw new Error(`OnboardingRun ${runId} not found`);
  if (!run.steps.some((s) => s.key === "a2p")) throw new Error("a2p step missing");

  const reg = await registerA2P({
    ein,
    brand: input.brand?.trim() || run.client.businessName,
    campaign: input.campaign?.trim() || `${run.client.businessName} bookings`,
    clientId: run.clientId,
  });

  // Store SIDs, never the raw EIN — keep only a masked tail for reference.
  const einMasked = ein.replace(/.(?=.{4})/g, "•");
  await prisma.provisioningStep.update({
    where: { runId_key: { runId, key: "a2p" } },
    data: {
      status: "blocked",
      result: {
        label: "A2P 10DLC",
        ...reg,
        einMasked,
        submittedAt: new Date().toISOString(),
        note: "A2P submitted — polling Twilio for approval.",
      } as Prisma.InputJsonValue,
    },
  });

  return pollOrScheduleA2P(runId);
}

/** First/next poll: schedule via QStash when available, else poll inline. */
async function pollOrScheduleA2P(runId: string) {
  if (qstashAvailable()) {
    await enqueueDelayed(
      `${appUrl()}/api/cron/a2p-poll`,
      { runId, secret: process.env.CRON_SECRET },
      A2P_POLL_DELAY_SECONDS
    );
    return prisma.onboardingRun.findUnique({ where: { id: runId }, include: { steps: true } });
  }
  return pollA2P(runId);
}

/**
 * Check A2P approval and react: approved -> mark done + advance; rejected ->
 * fail; pending -> reschedule another poll. Called by the QStash webhook and,
 * inline, when QStash isn't configured.
 */
export async function pollA2P(runId: string) {
  const step = await prisma.provisioningStep.findUnique({
    where: { runId_key: { runId, key: "a2p" } },
  });
  if (!step) throw new Error(`a2p step not found on run ${runId}`);
  if (step.status === "done") {
    return prisma.onboardingRun.findUnique({ where: { id: runId }, include: { steps: true } });
  }

  const result = (step.result as { brandSid?: string } | null) ?? {};
  if (!result.brandSid) {
    // Not submitted yet — nothing to poll.
    return prisma.onboardingRun.findUnique({ where: { id: runId }, include: { steps: true } });
  }

  const run = await prisma.onboardingRun.findUnique({ where: { id: runId } });
  const status = await getA2PStatus(result.brandSid, run!.clientId);

  if (status === "approved") {
    await prisma.provisioningStep.update({
      where: { runId_key: { runId, key: "a2p" } },
      data: {
        status: "done",
        result: { ...result, status: "approved", approvedAt: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    });
    return advanceRun(runId);
  }

  if (status === "rejected") {
    await prisma.provisioningStep.update({
      where: { runId_key: { runId, key: "a2p" } },
      data: { status: "failed", result: { ...result, status: "rejected" } as Prisma.InputJsonValue },
    });
    return advanceRun(runId); // engine flips the run to failed
  }

  // Still pending — reschedule the next poll if QStash is wired up.
  if (qstashAvailable()) {
    await enqueueDelayed(
      `${appUrl()}/api/cron/a2p-poll`,
      { runId, secret: process.env.CRON_SECRET },
      A2P_POLL_DELAY_SECONDS
    );
  }
  return prisma.onboardingRun.findUnique({ where: { id: runId }, include: { steps: true } });
}

/**
 * Operator edits the generated config directly. Validates it, persists it, and
 * re-runs the downstream brain steps (generate_prompt -> qa_review) so the agent
 * prompt reflects the edit. Already-done provisioning steps are NOT redone (their
 * idempotent handlers preserve live agents/numbers); the run simply re-settles.
 */
export async function updateConfigAndRerun(runId: string, config: unknown) {
  const run = await prisma.onboardingRun.findUnique({
    where: { id: runId },
    select: { clientId: true },
  });
  if (!run) throw new Error(`OnboardingRun ${runId} not found`);

  const parsed = switchboardConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.issues[0]?.message}`);
  }

  await prisma.switchboardClient.update({
    where: { id: run.clientId },
    data: {
      config: parsed.data as Prisma.InputJsonValue,
      businessName: parsed.data.business_name,
      vertical: parsed.data.vertical,
    },
  });

  await prisma.provisioningStep.updateMany({
    where: { runId, key: { in: ["generate_prompt", "qa_review"] } },
    data: { status: "pending", result: Prisma.JsonNull },
  });

  return advanceRun(runId);
}

/** Edit the intake text, reset the brain steps, and re-run from generate_config. */
export async function updateIntakeAndRerun(runId: string, intakeText: string) {
  const trimmed = intakeText.trim();
  if (!trimmed) throw new Error("Intake text cannot be empty.");

  const run = await prisma.onboardingRun.findUnique({
    where: { id: runId },
    include: { steps: true },
  });
  if (!run) throw new Error(`OnboardingRun ${runId} not found`);

  const intake = run.steps.find((s) => s.key === "intake");
  const prevResult = (intake?.result as Record<string, unknown> | null) ?? {};

  await prisma.provisioningStep.update({
    where: { runId_key: { runId, key: "intake" } },
    data: { result: { ...prevResult, intakeText: trimmed } },
  });

  // Regenerate everything downstream of intake.
  await prisma.provisioningStep.updateMany({
    where: { runId, key: { in: ["generate_config", "generate_prompt", "qa_review"] } },
    data: { status: "pending", result: Prisma.JsonNull },
  });

  return advanceRun(runId);
}
