/**
 * Deterministic checks for the workspace-setup path (run: `npm run test:setup`).
 *
 * Covers the spec's automatable cases without a live DB or API key:
 *   - Template loader: Switchboard blueprint normalizes + validates, with the
 *     right counts, name-resolvable automations, and checklist owners.
 *   - Caps: a 9-stage / 7-template / 6-automation config validates (would have
 *     failed before Feature 1 raised the caps).
 *   - Invariant: an automation referencing a missing template fails validation.
 *
 * DB persistence and AI extraction are exercised manually (see the spec's
 * dogfood test) since they require Turso + ANTHROPIC_API_KEY.
 */

import { validateWorkspaceConfig } from "@/lib/workspace-config";
import { getBlueprint, listBlueprintSummaries } from "@/lib/templates";

let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function expectThrows(name: string, fn: () => void) {
  try {
    fn();
    failures++;
    console.error(`  ✗ ${name} — expected validation to throw, but it passed`);
  } catch {
    console.log(`  ✓ ${name}`);
  }
}

// ── 1. Template loader ──────────────────────────────────────────────────────
console.log("\nTemplate loader (Switchboard blueprint):");
{
  const bp = getBlueprint("switchboard-ai-receptionist");
  check("blueprint is registered", !!bp);

  if (bp) {
    const cfg = bp.config;
    check("7 stages", cfg.stages.length === 7, `got ${cfg.stages.length}`);
    check(
      "6 email templates",
      cfg.emailTemplates.length === 6,
      `got ${cfg.emailTemplates.length}`
    );
    check(
      "6 automations",
      cfg.automationRules.length === 6,
      `got ${cfg.automationRules.length}`
    );
    check(
      "13 custom fields",
      (cfg.customFields?.length ?? 0) === 13,
      `got ${cfg.customFields?.length ?? 0}`
    );

    // Validates through the shared gate (this is what persistence requires).
    let validated = false;
    try {
      validateWorkspaceConfig(cfg);
      validated = true;
    } catch (err) {
      console.error("    validation error:", (err as Error).message);
    }
    check("blueprint passes validateWorkspaceConfig", validated);

    // Automations resolve to real stages by name (mirrors transaction linking).
    const stageNames = new Set(cfg.stages.map((s) => s.name));
    const unresolved = cfg.automationRules.filter(
      (r) => r.triggerStageName && !stageNames.has(r.triggerStageName)
    );
    check(
      "every stage-scoped automation resolves to a stage",
      unresolved.length === 0,
      unresolved.map((r) => r.triggerStageName).join(", ")
    );

    // Template refs resolve by name.
    const templateNames = new Set(cfg.emailTemplates.map((t) => t.name));
    const badTemplateRefs = cfg.automationRules.filter(
      (r) => !templateNames.has(r.templateName)
    );
    check("every automation resolves to a template", badTemplateRefs.length === 0);

    // Checklist owner values persist as assignedTo team/client.
    const allOwnersValid = cfg.stages.every((s) =>
      s.checklist.every(
        (c) => c.assignedTo === "team" || c.assignedTo === "client"
      )
    );
    check("checklist owners are team|client", allOwnersValid);
    const hasClientOwned = cfg.stages.some((s) =>
      s.checklist.some((c) => c.assignedTo === "client")
    );
    check("at least one client-owned checklist item", hasClientOwned);

    // Custom fields carry SELECT options through.
    const selectWithOptions = (cfg.customFields ?? []).filter(
      (f) => f.type === "SELECT" && (f.options?.length ?? 0) > 0
    );
    check("SELECT custom fields keep their options", selectWithOptions.length >= 1);
  }

  const summaries = listBlueprintSummaries();
  check("summary exposes stageCount", summaries[0]?.stageCount === 7);
  check("summary exposes vertical", summaries[0]?.vertical === "agency");
}

// ── 2. Caps (raised by Feature 1) ───────────────────────────────────────────
console.log("\nCaps — rich config (9 stages / 7 templates / 6 automations):");
{
  const templates = Array.from({ length: 7 }, (_, i) => ({
    name: `Template ${i + 1}`,
    subject: `Subject ${i + 1}`,
    body: `<p>Body ${i + 1}</p>`,
    type: "CUSTOM" as const,
  }));
  const stages = Array.from({ length: 9 }, (_, i) => ({
    name: `Stage ${i + 1}`,
    description: `Stage ${i + 1} description`,
    color: "#6366F1",
    daysExpected: 3,
    checklist: [
      { title: "Task A", isRequired: true, assignedTo: "team" as const },
      { title: "Task B", isRequired: false, assignedTo: "client" as const },
      { title: "Task C", isRequired: true, assignedTo: "team" as const },
    ],
  }));
  const automations = Array.from({ length: 6 }, (_, i) => ({
    name: `Automation ${i + 1}`,
    triggerType: "STAGE_ENTRY" as const,
    triggerStageName: `Stage ${i + 1}`,
    templateName: `Template ${i + 1}`,
  }));

  const richConfig = {
    pipeline: { name: "Rich Pipeline", description: "A rich pipeline" },
    stages,
    emailTemplates: templates,
    automationRules: automations,
    customFields: [],
  };

  let ok = false;
  try {
    validateWorkspaceConfig(richConfig);
    ok = true;
  } catch (err) {
    console.error("    validation error:", (err as Error).message);
  }
  check("9/7/6 config validates under raised caps", ok);
}

// ── 3. Invariant — automation must reference an existing template ───────────
console.log("\nInvariant — automation referencing a missing template:");
{
  expectThrows("config with dangling templateName fails validation", () => {
    validateWorkspaceConfig({
      pipeline: { name: "P", description: "d" },
      stages: Array.from({ length: 4 }, (_, i) => ({
        name: `S${i}`,
        description: "d",
        color: "#000000",
        daysExpected: 1,
        checklist: [
          { title: "a", isRequired: true, assignedTo: "team" },
          { title: "b", isRequired: true, assignedTo: "team" },
          { title: "c", isRequired: true, assignedTo: "team" },
        ],
      })),
      emailTemplates: [
        { name: "Real", subject: "s", body: "b", type: "WELCOME" },
        { name: "Real2", subject: "s", body: "b", type: "CUSTOM" },
        { name: "Real3", subject: "s", body: "b", type: "CUSTOM" },
      ],
      automationRules: [
        { name: "ok", triggerType: "CLIENT_CREATED", templateName: "Real" },
        {
          name: "bad",
          triggerType: "CLIENT_CREATED",
          templateName: "Does Not Exist",
        },
      ],
      customFields: [],
    });
  });
}

// ── 4. Too-few stages fails (lower bound of the cap) ────────────────────────
console.log("\nCaps lower bound — 3 stages should fail (min is 4):");
{
  expectThrows("3-stage config fails validation", () => {
    validateWorkspaceConfig({
      pipeline: { name: "P", description: "d" },
      stages: Array.from({ length: 3 }, (_, i) => ({
        name: `S${i}`,
        description: "d",
        color: "#000000",
        daysExpected: 1,
        checklist: [
          { title: "a", isRequired: true, assignedTo: "team" },
          { title: "b", isRequired: true, assignedTo: "team" },
          { title: "c", isRequired: true, assignedTo: "team" },
        ],
      })),
      emailTemplates: [
        { name: "A", subject: "s", body: "b", type: "WELCOME" },
        { name: "B", subject: "s", body: "b", type: "CUSTOM" },
        { name: "C", subject: "s", body: "b", type: "CUSTOM" },
      ],
      automationRules: [
        { name: "ok", triggerType: "CLIENT_CREATED", templateName: "A" },
        { name: "ok2", triggerType: "CLIENT_CREATED", templateName: "B" },
      ],
      customFields: [],
    });
  });
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) failed.\n`
);
process.exit(failures === 0 ? 0 : 1);
