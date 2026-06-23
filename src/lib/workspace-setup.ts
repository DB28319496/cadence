// Shared persistence for the workspace-setup path. All three onboarding
// on-ramps — AI questionnaire, curated template, and paste-a-doc — normalize
// their output into a single `WorkspaceConfig` (see ./workspace-config),
// validate it, and persist it here. One validated, transactional write path
// regardless of how the config was produced.

import { prisma } from "@/lib/prisma";
import type { WorkspaceConfig } from "@/lib/workspace-config";

// Re-export the validation surface so call sites can import config + persist
// from one place.
export {
  workspaceConfigSchema,
  validateWorkspaceConfig,
} from "@/lib/workspace-config";
export type {
  WorkspaceConfig,
  WorkspaceConfigInput,
  WorkspaceConfigStage,
  WorkspaceConfigCustomField,
} from "@/lib/workspace-config";

/**
 * Replace a workspace's pipeline/templates/automations/custom-fields with the
 * given config and mark onboarding complete. Resolves automation stage refs and
 * template refs by name inside the transaction (mirrors the generator's
 * name-based linking). Idempotent: clears prior starter content first.
 */
export async function persistWorkspaceConfig(
  workspaceId: string,
  config: WorkspaceConfig
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Clear any existing starter content (from signup defaults or a prior run)
    await tx.automationRule.deleteMany({ where: { workspaceId } });
    await tx.emailTemplate.deleteMany({ where: { workspaceId } });
    await tx.stage.deleteMany({ where: { pipeline: { workspaceId } } });
    await tx.pipeline.deleteMany({ where: { workspaceId } });
    await tx.customField.deleteMany({ where: { workspaceId } });

    // Pipeline
    const pipeline = await tx.pipeline.create({
      data: {
        name: config.pipeline.name,
        description: config.pipeline.description,
        isDefault: true,
        isActive: true,
        workspaceId,
      },
    });

    // Stages (checklist stored as JSON, name → id for automation resolution)
    const stageByName = new Map<string, string>();
    for (let i = 0; i < config.stages.length; i++) {
      const s = config.stages[i];
      const checklistWithIds = s.checklist.map((item, idx) => ({
        id: `${s.name.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
        title: item.title,
        isRequired: item.isRequired,
        assignedTo: item.assignedTo,
      }));

      const stage = await tx.stage.create({
        data: {
          name: s.name,
          description: s.description,
          color: s.color,
          daysExpected: s.daysExpected,
          order: i,
          checklist: JSON.stringify(checklistWithIds),
          pipelineId: pipeline.id,
        },
      });
      stageByName.set(s.name, stage.id);
    }

    // Email templates (name → id for automation resolution)
    const templateByName = new Map<string, string>();
    for (const t of config.emailTemplates) {
      const template = await tx.emailTemplate.create({
        data: {
          name: t.name,
          subject: t.subject,
          body: t.body,
          type: t.type,
          isActive: true,
          workspaceId,
        },
      });
      templateByName.set(t.name, template.id);
    }

    // Automation rules — resolve template + stage names → ids
    for (const rule of config.automationRules) {
      const templateId = templateByName.get(rule.templateName);
      if (!templateId) continue; // skip rules with invalid template refs

      const stageId = rule.triggerStageName
        ? stageByName.get(rule.triggerStageName)
        : undefined;

      const triggerConfig: Record<string, unknown> = {};
      if (rule.triggerType === "STAGE_ENTRY" && stageId) {
        triggerConfig.stageId = stageId;
      } else if (rule.triggerType === "TIME_IN_STAGE") {
        if (stageId) triggerConfig.stageId = stageId;
        if (rule.triggerDays) triggerConfig.days = rule.triggerDays;
      }

      await tx.automationRule.create({
        data: {
          name: rule.name,
          triggerType: rule.triggerType,
          triggerConfig: JSON.stringify(triggerConfig),
          actionType: "SEND_EMAIL",
          actionConfig: JSON.stringify({ templateId }),
          stageId: stageId ?? null,
          templateId,
          isActive: true,
          workspaceId,
        },
      });
    }

    // Custom fields (additive — generator-built workspaces pass [])
    for (let i = 0; i < config.customFields.length; i++) {
      const cf = config.customFields[i];
      await tx.customField.create({
        data: {
          name: cf.name,
          type: cf.type,
          options: cf.options ? JSON.stringify(cf.options) : null,
          required: cf.required ?? false,
          order: i,
          workspaceId,
        },
      });
    }

    // Mark onboarding complete
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompleted: true },
    });
  });
}
