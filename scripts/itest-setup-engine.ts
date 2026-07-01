/**
 * End-to-end dogfood for the Switchboard setup engine, Phase 1 (run:
 * `npm run itest:setup`). Uses the deterministic LLM stub, so it needs ZERO
 * third-party API keys — only the local SQLite DB.
 *
 * Exercises: happy path (intake -> config -> prompt -> QA go -> blocks at the
 * first Phase-2 step), missing-field block, QA no-go block, and edit-intake +
 * re-run recovery. Cleans up everything it creates.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnv(".env.local");
process.env.DATABASE_URL ||= "file:./prisma/dev.db";
process.env.SWITCHBOARD_LLM_STUB = "true"; // deterministic brain
process.env.SWITCHBOARD_PROVISION_STUB = "true"; // deterministic provisioning

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  passed++;
  console.log(`  ✓ ${msg}`);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const {
    createRunFromIntake,
    updateIntakeAndRerun,
    updateConfigAndRerun,
    retryStep,
    markStepDone,
    submitA2P,
  } = await import("../src/lib/setup/service");

  const createdClientIds: string[] = [];
  const load = (runId: string) =>
    prisma.onboardingRun.findUnique({
      where: { id: runId },
      include: { steps: true, client: true },
    });
  const stepStatus = (
    run: { steps: { key: string; status: string }[] },
    key: string
  ) => run.steps.find((s) => s.key === key)?.status;

  // ── Scenario 1: happy path (paste) — brain + provisioning to first wall ───
  console.log("\n[1] Happy path — paste intake runs the brain + provisioning");
  {
    const { runId, clientId } = await createRunFromIntake({
      mode: "paste",
      text: "Business name: Summit Auto Care\nWe fix cars in Springfield. Open Mon-Fri 8-6.",
    });
    createdClientIds.push(clientId);
    const run = (await load(runId))!;
    assert(stepStatus(run, "intake") === "done", "intake is done");
    assert(stepStatus(run, "generate_config") === "done", "generate_config is done");
    assert(stepStatus(run, "generate_prompt") === "done", "generate_prompt is done");
    assert(stepStatus(run, "qa_review") === "done", "qa_review is done (go)");
    assert(run.status === "blocked", "run is blocked");
    assert(run.currentStep === "forwarding", "blocked at forwarding (first manual wall)");
    assert(!!run.client.config, "config persisted on client");
    assert(run.client.vertical === "auto", "vertical synced to 'auto'");
    assert(run.client.businessName === "Summit Auto Care", "businessName synced from config");
    assert(!!run.client.systemPrompt && run.client.systemPrompt.includes("ROLE"), "system prompt generated");
  }

  // ── Scenario 2: missing fields block at generate_config ───────────────────
  console.log("\n[2] Missing fields — blocks at generate_config");
  let missingRunId = "";
  {
    const { runId, clientId } = await createRunFromIntake({
      mode: "paste",
      text: "Some HVAC company. [[MISSING]]",
    });
    createdClientIds.push(clientId);
    missingRunId = runId;
    const run = (await load(runId))!;
    assert(run.status === "blocked", "run is blocked");
    assert(run.currentStep === "generate_config", "blocked at generate_config");
    const gc = run.steps.find((s) => s.key === "generate_config")!;
    const missing = (gc.result as { missing?: string[] } | null)?.missing ?? [];
    assert(missing.includes("hours"), "missing list names 'hours'");
    assert(stepStatus(run, "generate_prompt") === "pending", "downstream still pending");
  }

  // ── Scenario 3: QA no-go block ────────────────────────────────────────────
  console.log("\n[3] QA no-go — blocks at qa_review");
  {
    const { runId, clientId } = await createRunFromIntake({
      mode: "form",
      form: {
        businessName: "Frosty HVAC",
        vertical: "hvac",
        city: "Springfield",
        hours: "Mon-Sun 7-7",
        services: "AC repair, furnace tune-up",
        phone: "+15555550111",
        ownerPhone: "+15555550100",
      },
    });
    createdClientIds.push(clientId);
    // Force a no-go by editing the intake to carry the sentinel.
    const run0 = await updateIntakeAndRerun(
      runId,
      "Business name: Frosty HVAC\nHVAC in Springfield, open Mon-Sun 7-7. [[NOGO]]"
    );
    assert(run0.status === "blocked", "run is blocked");
    assert(run0.currentStep === "qa_review", "blocked at qa_review");
    const qa = run0.steps.find((s) => s.key === "qa_review")!;
    const verdict = (qa.result as { verdict?: string } | null)?.verdict;
    assert(verdict === "no-go", "qa verdict is no-go");
  }

  // ── Scenario 4: edit intake + re-run recovers the missing-fields run ──────
  console.log("\n[4] Edit intake + re-run — recovers the blocked missing-fields run");
  {
    const run = await updateIntakeAndRerun(
      missingRunId,
      "Business name: Recovered HVAC\nHVAC in Springfield. Open Mon-Fri 8-6. Owner +15555550100."
    );
    assert(run.status === "blocked", "run is blocked again (at a manual wall)");
    assert(run.currentStep === "forwarding", "now advances through provisioning to forwarding");
    assert(stepStatus(run, "generate_config") === "done", "generate_config now done");
    assert(stepStatus(run, "qa_review") === "done", "qa_review now done");
  }

  // ── Scenario 5: retry is idempotent (no duplicate clients/runs) ───────────
  console.log("\n[5] Retry a done step — safe, run stays consistent");
  {
    const run = await retryStep(missingRunId, "generate_config");
    assert(run.currentStep === "forwarding", "still blocked at forwarding after retry");
    const clients = await prisma.switchboardClient.count();
    assert(clients >= createdClientIds.length, "no clients lost");
  }

  // ── Scenario 6: full path to go-live (provisioning + manual walls + A2P) ──
  console.log("\n[6] Full path to go-live — provisioning, manual walls, A2P");
  {
    const { runId, clientId } = await createRunFromIntake({
      mode: "paste",
      text: "Business name: Live Auto Care\nAuto shop in Springfield. Open Mon-Fri 8-6.",
    });
    createdClientIds.push(clientId);
    let run = (await load(runId))!;

    // Brain + 4 provisioning auto steps done; halts at the first manual wall.
    assert(run.status === "blocked", "blocked after provisioning");
    assert(run.currentStep === "forwarding", "halts at forwarding (first manual wall)");
    for (const k of ["provision_voice", "provision_calcom", "provision_twilio", "register_n8n"]) {
      assert(stepStatus(run, k) === "done", `${k} is done`);
    }
    const cfg = run.client.config as Record<string, unknown>;
    assert(!!cfg.agent_id, "agent_id written to config");
    assert(!!cfg.agent_number, "agent_number written to config");
    assert(
      !!cfg.event_type_ids && Object.keys(cfg.event_type_ids as object).length > 0,
      "event_type_ids written to config"
    );
    const agentIdBefore = cfg.agent_id;

    // Idempotency: retry an already-done provisioning step -> no duplicate create.
    await retryStep(runId, "provision_voice");
    run = (await load(runId))!;
    assert(
      (run.client.config as Record<string, unknown>).agent_id === agentIdBefore,
      "provision_voice retry kept the same agent_id (idempotent)"
    );
    assert(run.currentStep === "forwarding", "still at forwarding after retry");

    // Forwarding -> mark done -> advances to a2p.
    await markStepDone(runId, "forwarding");
    run = (await load(runId))!;
    assert(run.currentStep === "a2p", "advanced to a2p after forwarding");
    assert(
      (run.steps.find((s) => s.key === "a2p")!.result as { needsEin?: boolean } | null)?.needsEin === true,
      "a2p presents the EIN checklist"
    );

    // A2P submit (stub approves inline) -> advances past a2p to trust_check.
    await submitA2P(runId, { ein: "12-3456789" });
    run = (await load(runId))!;
    assert(stepStatus(run, "a2p") === "done", "a2p approved + done after submit (stub)");
    assert(run.currentStep === "trust_check", "advanced to trust_check");
    const a2pRes = run.steps.find((s) => s.key === "a2p")!.result as {
      brandSid?: string;
      einMasked?: string;
    } | null;
    assert(!!a2pRes?.brandSid, "a2p brandSid stored");
    assert(
      !!a2pRes?.einMasked && !a2pRes.einMasked.includes("123456"),
      "EIN stored masked, not raw"
    );

    // Trust check -> mark done -> go_live (auto) -> run live.
    await markStepDone(runId, "trust_check");
    run = (await load(runId))!;
    assert(run.status === "live", "run is LIVE after trust_check + go_live");
    assert(stepStatus(run, "go_live") === "done", "go_live is done");
    assert(run.client.status === "live", "client status flipped to live");
    assert(!!(run.client.config as Record<string, unknown>).watch_until, "48h watch flag set");
  }

  // ── Scenario 7: edit config -> regenerate prompt + QA, preserve provisioning ─
  console.log("\n[7] Edit config — regenerates prompt + QA, preserves provisioning");
  {
    const { runId, clientId } = await createRunFromIntake({
      mode: "paste",
      text: "Business name: Edit Test Auto\nAuto shop in Springfield. Open Mon-Fri 8-6.",
    });
    createdClientIds.push(clientId);
    let run = (await load(runId))!;
    assert(run.currentStep === "forwarding", "reached forwarding after provisioning");
    const cfg = run.client.config as Record<string, unknown>;
    const agentIdBefore = cfg.agent_id;
    assert(run.client.systemPrompt!.includes("Springfield"), "prompt mentions original city");

    await updateConfigAndRerun(runId, { ...cfg, city: "Newtown" });
    run = (await load(runId))!;
    assert((run.client.config as Record<string, unknown>).city === "Newtown", "config city updated");
    assert(run.client.systemPrompt!.includes("Newtown"), "prompt regenerated with new city");
    assert(
      (run.client.config as Record<string, unknown>).agent_id === agentIdBefore,
      "provisioning preserved (agent_id unchanged)"
    );
    assert(run.currentStep === "forwarding", "re-settled at forwarding (provisioning not redone)");
  }

  // ── Scenario 8: stepwise (serverless-safe) one-step-per-call advance ──────
  console.log("\n[8] Stepwise advance — one auto step per call (serverless mode)");
  {
    const { advanceRun } = await import("../src/lib/engine");
    process.env.SWITCHBOARD_ASYNC = "true"; // create advances exactly one step
    const { runId, clientId } = await createRunFromIntake({
      mode: "paste",
      text: "Business name: Step Test Auto\nAuto shop in Springfield. Open Mon-Fri 8-6.",
    });
    process.env.SWITCHBOARD_ASYNC = ""; // reset so other logic is unaffected
    createdClientIds.push(clientId);

    let run = (await load(runId))!;
    assert(run.status === "running", "async create advanced exactly one step (still running)");
    assert(stepStatus(run, "generate_config") === "done", "generate_config done after 1 step");
    assert(stepStatus(run, "generate_prompt") === "pending", "generate_prompt still pending (1 step only)");

    // Drive the rest one step at a time, like the run-page poller does.
    let guard = 0;
    while (run.status === "running" && guard++ < 25) {
      await advanceRun(runId, { maxSteps: 1 });
      run = (await load(runId))!;
    }
    assert(run.currentStep === "forwarding", "stepwise driver reached forwarding");
    assert(stepStatus(run, "qa_review") === "done", "qa_review done via stepwise driver");
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\n[cleanup] removing test clients (cascades runs + steps)");
  await prisma.switchboardClient.deleteMany({ where: { id: { in: createdClientIds } } });
  const leftover = await prisma.onboardingRun.count({
    where: { clientId: { in: createdClientIds } },
  });
  assert(leftover === 0, "runs cascade-deleted with clients");

  await prisma.$disconnect();
  console.log(`\n✅ All ${passed} assertions passed.`);
}

main().catch(async (err) => {
  console.error("\n❌", err);
  process.exit(1);
});
