/**
 * Integration test for the real persistence path (run: `npm run itest:persist`).
 *
 * Unlike test-workspace-setup.ts (pure logic), this writes to the actual local
 * dev database: it creates a throwaway workspace, runs the Switchboard blueprint
 * through `persistWorkspaceConfig`, asserts the rows that landed (stages,
 * name→id automation linking, checklist owners, custom fields), then deletes
 * the workspace (cascade). No API key required.
 *
 * Env (DATABASE_URL etc.) is loaded from .env.local before importing prisma.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Load .env.local into process.env BEFORE importing prisma-backed modules ──
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
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

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  // Dynamic imports so the env above is set before prisma constructs its client.
  const { prisma } = await import("../src/lib/prisma");
  const { getBlueprint } = await import("../src/lib/templates");
  const { validateWorkspaceConfig, persistWorkspaceConfig } = await import(
    "../src/lib/workspace-setup"
  );

  const bp = getBlueprint("switchboard-ai-receptionist");
  if (!bp) throw new Error("Switchboard blueprint not found");
  const config = validateWorkspaceConfig(bp.config);

  const slug = `itest-switchboard-${Date.now()}`;
  const workspace = await prisma.workspace.create({
    data: { name: "ITEST Switchboard", slug, emailFromName: "ITEST" },
  });

  try {
    await persistWorkspaceConfig(workspace.id, config);

    // ── Pipeline ────────────────────────────────────────────────────────────
    console.log("\nPipeline:");
    const pipelines = await prisma.pipeline.findMany({
      where: { workspaceId: workspace.id },
    });
    check("one pipeline created", pipelines.length === 1);
    check("pipeline is default", pipelines[0]?.isDefault === true);
    check(
      "pipeline name carried through",
      pipelines[0]?.name === "Switchboard Client Lifecycle"
    );

    // ── Stages ────────────────────────────────────────────────────────────
    console.log("\nStages:");
    const stages = await prisma.stage.findMany({
      where: { pipelineId: pipelines[0].id },
      orderBy: { order: "asc" },
    });
    check("7 stages persisted", stages.length === 7, `got ${stages.length}`);
    check(
      "stages ordered 0..6",
      stages.every((s, i) => s.order === i)
    );
    const stageByName = new Map(stages.map((s) => [s.name, s]));
    check(
      "last stage name preserved (em dash intact)",
      stageByName.has("Live — ROI & Retention")
    );

    // Checklist owners survive the round-trip as assignedTo.
    const audit = stageByName.get("Missed-Call Audit");
    const auditChecklist: Array<{ title: string; assignedTo: string }> =
      JSON.parse(audit?.checklist ?? "[]");
    check(
      "checklist items have ids + assignedTo",
      auditChecklist.length === 4 &&
        auditChecklist.every(
          (c) => c.assignedTo === "team" || c.assignedTo === "client"
        )
    );
    check(
      "client-owned checklist item persisted",
      auditChecklist.some(
        (c) =>
          c.assignedTo === "client" &&
          c.title.includes("Grant access to call data")
      )
    );

    // ── Email templates ─────────────────────────────────────────────────────
    console.log("\nEmail templates:");
    const templates = await prisma.emailTemplate.findMany({
      where: { workspaceId: workspace.id },
    });
    check("6 templates persisted", templates.length === 6, `got ${templates.length}`);
    const templateByName = new Map(templates.map((t) => [t.name, t]));

    // ── Automations (name → id resolution is the key thing to verify) ───────
    console.log("\nAutomations:");
    const automations = await prisma.automationRule.findMany({
      where: { workspaceId: workspace.id },
    });
    check("6 automations persisted", automations.length === 6, `got ${automations.length}`);

    const byName = new Map(automations.map((a) => [a.name, a]));

    const welcome = byName.get("Welcome new lead");
    check(
      "CLIENT_CREATED automation links template, no stage",
      welcome?.triggerType === "CLIENT_CREATED" &&
        welcome?.stageId === null &&
        welcome?.templateId === templateByName.get("Audit Request Welcome")?.id
    );

    const auditReport = byName.get("Send audit report");
    check(
      "STAGE_ENTRY automation resolves stage + template by name",
      auditReport?.triggerType === "STAGE_ENTRY" &&
        auditReport?.stageId === stageByName.get("Discovery & Demo")?.id &&
        auditReport?.templateId === templateByName.get("Audit Report Ready")?.id
    );
    check(
      "STAGE_ENTRY triggerConfig carries stageId",
      JSON.parse(auditReport?.triggerConfig ?? "{}").stageId ===
        stageByName.get("Discovery & Demo")?.id
    );

    const roi = byName.get("Monthly ROI report");
    const roiCfg = JSON.parse(roi?.triggerConfig ?? "{}");
    check(
      "TIME_IN_STAGE automation resolves em-dash stage by name",
      roi?.triggerType === "TIME_IN_STAGE" &&
        roi?.stageId === stageByName.get("Live — ROI & Retention")?.id &&
        roi?.templateId === templateByName.get("Monthly ROI Report")?.id
    );
    check(
      "TIME_IN_STAGE triggerConfig carries stageId + days",
      roiCfg.stageId === stageByName.get("Live — ROI & Retention")?.id &&
        roiCfg.days === 30
    );

    // ── Custom fields (additive seeding) ────────────────────────────────────
    console.log("\nCustom fields:");
    const fields = await prisma.customField.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    });
    check("13 custom fields persisted", fields.length === 13, `got ${fields.length}`);
    const vertical = fields.find((f) => f.name === "Vertical");
    check(
      "SELECT field stores options as JSON",
      vertical?.type === "SELECT" &&
        JSON.parse(vertical?.options ?? "[]").includes("HVAC")
    );
    check(
      "NUMBER field stores no options",
      fields.find((f) => f.name === "MRR ($)")?.options === null
    );

    // ── Workspace flag ──────────────────────────────────────────────────────
    console.log("\nWorkspace:");
    const ws = await prisma.workspace.findUnique({ where: { id: workspace.id } });
    check("onboardingCompleted set to true", ws?.onboardingCompleted === true);
  } finally {
    // Cleanup — cascade removes pipeline/stages/templates/automations/fields.
    await prisma.workspace.delete({ where: { id: workspace.id } });
    console.log("\n(cleaned up throwaway workspace)");
    await prisma.$disconnect();
  }

  console.log(
    failures === 0 ? "\nAll integration checks passed.\n" : `\n${failures} check(s) failed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nIntegration test crashed:", err);
  process.exit(1);
});
