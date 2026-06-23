// Curated template library (Feature 2). Each blueprint is a hand-authored
// vertical workspace that matches the exact shape `create_workspace_config`
// produces, so it persists through the same shared, validated path with no AI
// call. Blueprints are authored in the raw JSON shape (checklist `text`/`owner`,
// name-based `triggerConfig`, `label`/`key` custom fields) and normalized here
// into the internal `WorkspaceConfig`.

import type { WorkspaceConfigInput } from "@/lib/workspace-config";
import switchboardRaw from "./blueprints/switchboard-cadence-blueprint.json";

// ── Raw authoring shape (as stored in the blueprint JSON files) ─────────────

type RawChecklistItem = { text: string; owner: "team" | "client" };

type RawStage = {
  name: string;
  description: string;
  color: string;
  daysExpected: number;
  checklist: RawChecklistItem[];
};

type RawTemplate = {
  name: string;
  type: "WELCOME" | "STAGE_CHANGE" | "FOLLOW_UP" | "REMINDER" | "CUSTOM";
  subject: string;
  body: string;
};

type RawAutomation = {
  name: string;
  triggerType: "CLIENT_CREATED" | "STAGE_ENTRY" | "TIME_IN_STAGE";
  templateName: string;
  triggerConfig?: { stageName?: string; fromStageName?: string; days?: number };
};

type RawCustomField = {
  label: string;
  key: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "CHECKBOX";
  options?: string[];
};

type RawBlueprint = {
  blueprint: {
    id: string;
    name: string;
    description: string;
    vertical: string;
    tone: string;
    pipeline: { name: string; isDefault?: boolean };
    stages: RawStage[];
    emailTemplates: RawTemplate[];
    automationRules: RawAutomation[];
    customFields: RawCustomField[];
  };
};

// ── Public blueprint shape ──────────────────────────────────────────────────

export type TemplateBlueprint = {
  id: string;
  name: string;
  description: string;
  vertical: string;
  /** Normalized, ready for `validateWorkspaceConfig` + `persistWorkspaceConfig`. */
  config: WorkspaceConfigInput;
};

/** Card-sized metadata for the onboarding gallery (no heavy config payload). */
export type BlueprintSummary = {
  id: string;
  name: string;
  description: string;
  vertical: string;
  stageCount: number;
};

// ── Normalizer: raw authoring shape → internal WorkspaceConfig ───────────────

function normalizeBlueprint(raw: RawBlueprint): TemplateBlueprint {
  const b = raw.blueprint;

  const config: WorkspaceConfigInput = {
    pipeline: {
      name: b.pipeline.name,
      // Raw pipeline has no description; use the blueprint's own description.
      description: b.description,
    },
    stages: b.stages.map((s) => ({
      name: s.name,
      description: s.description,
      color: s.color,
      daysExpected: s.daysExpected,
      checklist: s.checklist.map((c) => ({
        title: c.text,
        isRequired: true,
        assignedTo: c.owner,
      })),
    })),
    emailTemplates: b.emailTemplates.map((t) => ({
      name: t.name,
      subject: t.subject,
      body: t.body,
      type: t.type,
    })),
    automationRules: b.automationRules.map((r) => ({
      name: r.name,
      triggerType: r.triggerType,
      // Name-based refs resolve to ids at insert time in the transaction.
      triggerStageName: r.triggerConfig?.stageName,
      triggerDays: r.triggerConfig?.days,
      templateName: r.templateName,
    })),
    customFields: b.customFields.map((cf) => ({
      // Prisma CustomField has `name` (not `label`) and no `key` column.
      name: cf.label,
      type: cf.type,
      options: cf.options,
    })),
  };

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    vertical: b.vertical,
    config,
  };
}

// ── Registry ────────────────────────────────────────────────────────────────

export const TEMPLATE_BLUEPRINTS: TemplateBlueprint[] = [
  normalizeBlueprint(switchboardRaw as RawBlueprint),
];

export function getBlueprint(id: string): TemplateBlueprint | undefined {
  return TEMPLATE_BLUEPRINTS.find((b) => b.id === id);
}

export function listBlueprintSummaries(): BlueprintSummary[] {
  return TEMPLATE_BLUEPRINTS.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    vertical: b.vertical,
    stageCount: b.config.stages.length,
  }));
}
