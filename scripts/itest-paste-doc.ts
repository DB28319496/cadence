/**
 * End-to-end dogfood for the paste-a-doc on-ramp (run: `npm run itest:paste`).
 *
 * Exercises the full live path against the real AI + local DB:
 *   pasted text -> extractOnboardingAnswers -> generateWorkspaceFromAnswers
 *   -> validate (raised caps) -> persist -> assert rows -> cleanup.
 *
 * Requires ANTHROPIC_API_KEY in .env.local. Makes two Claude calls.
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
    )
      val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv(".env.local");

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// A realistic process doc (not the questionnaire fields) for the model to read.
const DOC = `
Switchboard Operating Manual

We run a done-for-you AI phone receptionist agency for local appointment-based
service businesses — auto repair shops, HVAC companies, plumbers. Our clients are
the shops we onboard; we get paid roughly $1k/mo plus a setup fee.

How a client moves through us: first we qualify a prospect shop (enough call
volume, phone-driven, can afford it). If they fit, we run a 1-2 week missed-call
audit on their real phone logs and produce a one-page report of what voicemail and
after-hours calls are costing them. We walk the owner through their own numbers on
a discovery call and demo a live agent on their shop's flow. Then we send a tiered
proposal anchored to the measured leak and close — no build starts until they sign
and pay. Onboarding & build is where reliability is won: we collect hours, services,
pricing, FAQs, calendar access, then configure and fully test the agent. We launch
on overflow/after-hours only and watch it closely for the first couple weeks. Once
live, we send a monthly ROI report, do monthly check-ins and upsells, and ask for
referrals after a strong month.

Where things stall: prospects go quiet after the proposal, and during onboarding
clients are slow to grant calendar and phone access, which delays go-live.

We're a small team (2-5 people) and we keep client comms professional but warm.
`.trim();

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set in .env.local — cannot run.");
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const {
    extractOnboardingAnswers,
    generateWorkspaceFromAnswers,
    generatedToWorkspaceConfig,
  } = await import("../src/lib/onboarding-ai");
  const { validateWorkspaceConfig, persistWorkspaceConfig } = await import(
    "../src/lib/workspace-setup"
  );

  // ── Step A — extraction ─────────────────────────────────────────────────
  console.log("\nStep A — extract six fields from the doc:");
  const answers = await extractOnboardingAnswers(DOC);
  if (!answers) {
    console.error("  ✗ extraction returned null (API error or no key)");
    process.exit(1);
  }
  console.log("  extracted:", JSON.stringify(answers, null, 2).replace(/\n/g, "\n  "));
  check("businessType non-empty", !!answers.businessType?.trim());
  check("services non-empty", !!answers.services?.trim());
  check("clientJourney non-empty", !!answers.clientJourney?.trim());
  check("painPoints non-empty", !!answers.painPoints?.trim());
  check(
    "tone is a valid enum",
    ["formal", "professional", "friendly"].includes(answers.tone)
  );
  check("teamSize non-empty", !!answers.teamSize?.trim());
  check(
    "businessType reflects the doc (phone/receptionist/call)",
    /phone|reception|call|answer/i.test(answers.businessType)
  );
  check(
    "painPoints captured a real stall (proposal/access/quiet)",
    /proposal|access|quiet|stall|slow|delay/i.test(answers.painPoints)
  );

  // ── Step B — generate ───────────────────────────────────────────────────
  console.log("\nStep B — generate workspace from extracted answers:");
  const generated = await generateWorkspaceFromAnswers(answers);
  if (!generated) {
    console.error("  ✗ generation returned null");
    process.exit(1);
  }
  console.log(
    "  pipeline:",
    generated.pipeline?.name,
    `| stages: ${generated.stages?.length}`,
    `| templates: ${generated.emailTemplates?.length}`,
    `| automations: ${generated.automationRules?.length}`
  );
  console.log("  stage names:", generated.stages?.map((s) => s.name).join(" → "));

  // ── Validate (raised caps + invariant on real AI output) ────────────────
  console.log("\nValidation:");
  let config;
  try {
    config = validateWorkspaceConfig(generatedToWorkspaceConfig(generated));
    console.log("  ✓ generated config passes validateWorkspaceConfig");
  } catch (err) {
    failures++;
    console.error("  ✗ validation failed:", (err as Error).message);
    process.exit(1);
  }
  check("stage count within raised caps (4-10)", config.stages.length >= 4 && config.stages.length <= 10);
  check("template count within caps (3-8)", config.emailTemplates.length >= 3 && config.emailTemplates.length <= 8);
  check("automation count within caps (2-8)", config.automationRules.length >= 2 && config.automationRules.length <= 8);
  const lifecycleish = config.stages.some((s) =>
    /audit|discover|demo|proposal|onboard|build|launch|live|retention|close|qualif/i.test(
      s.name
    )
  );
  check("pipeline resembles the lifecycle in the doc", lifecycleish);

  // ── Persist + assert (real DB) ──────────────────────────────────────────
  console.log("\nPersist to a throwaway workspace:");
  const ws = await prisma.workspace.create({
    data: {
      name: "ITEST Paste",
      slug: `itest-paste-${Date.now()}`,
      emailFromName: "ITEST",
    },
  });
  try {
    await persistWorkspaceConfig(ws.id, config);
    const [stages, templates, automations, fields, fresh] = await Promise.all([
      prisma.stage.count({ where: { pipeline: { workspaceId: ws.id } } }),
      prisma.emailTemplate.count({ where: { workspaceId: ws.id } }),
      prisma.automationRule.count({ where: { workspaceId: ws.id } }),
      prisma.customField.count({ where: { workspaceId: ws.id } }),
      prisma.workspace.findUnique({ where: { id: ws.id } }),
    ]);
    check("stages persisted", stages === config.stages.length);
    check("templates persisted", templates === config.emailTemplates.length);
    check("automations persisted (<= rules, invalid refs skipped)", automations <= config.automationRules.length && automations > 0);
    check("generator-built workspace seeds no custom fields", fields === 0);
    check("onboardingCompleted set", fresh?.onboardingCompleted === true);
  } finally {
    await prisma.workspace.delete({ where: { id: ws.id } });
    console.log("\n(cleaned up throwaway workspace)");
    await prisma.$disconnect();
  }

  console.log(
    failures === 0
      ? "\nPaste-a-doc end-to-end passed.\n"
      : `\n${failures} check(s) failed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nPaste-a-doc test crashed:", err);
  process.exit(1);
});
