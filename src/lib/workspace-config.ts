// Shared, prisma-free workspace config: the normalized shape every onboarding
// on-ramp (AI questionnaire, curated template, paste-a-doc) converges on, plus
// the zod validator that gates persistence. Kept free of DB imports so it can
// be validated in isolation (and reused anywhere).

import { z } from "zod";

const checklistItemSchema = z.object({
  title: z.string().min(1),
  isRequired: z.boolean(),
  assignedTo: z.enum(["team", "client"]),
});

const stageSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  color: z.string().min(1),
  daysExpected: z.number().int().min(1).max(30),
  // Raised: 3–8 checklist items per stage (was 3–6)
  checklist: z.array(checklistItemSchema).min(3).max(8),
});

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  type: z.enum(["WELCOME", "STAGE_CHANGE", "FOLLOW_UP", "REMINDER", "CUSTOM"]),
});

const automationSchema = z.object({
  name: z.string().min(1),
  triggerType: z.enum(["CLIENT_CREATED", "STAGE_ENTRY", "TIME_IN_STAGE"]),
  triggerStageName: z.string().optional(),
  triggerDays: z.number().int().positive().optional(),
  templateName: z.string().min(1),
});

const customFieldSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "CHECKBOX"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

export const workspaceConfigSchema = z
  .object({
    pipeline: z.object({
      name: z.string().min(1),
      description: z.string().min(1),
    }),
    // Raised caps (Feature 1): 4–10 stages, 3–8 templates, 2–8 automations
    stages: z.array(stageSchema).min(4).max(10),
    emailTemplates: z.array(templateSchema).min(3).max(8),
    automationRules: z.array(automationSchema).min(2).max(8),
    // Additive: AI generator passes []; templates may seed custom fields.
    customFields: z.array(customFieldSchema).default([]),
  })
  .superRefine((cfg, ctx) => {
    // Invariant: every automation's templateName matches a template name exactly.
    const names = new Set(cfg.emailTemplates.map((t) => t.name));
    cfg.automationRules.forEach((rule, i) => {
      if (!names.has(rule.templateName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `automationRules[${i}].templateName "${rule.templateName}" has no matching email template`,
          path: ["automationRules", i, "templateName"],
        });
      }
    });
  });

// Input shape (customFields optional) vs. parsed shape (customFields defaulted).
export type WorkspaceConfigInput = z.input<typeof workspaceConfigSchema>;
export type WorkspaceConfig = z.output<typeof workspaceConfigSchema>;
export type WorkspaceConfigStage = z.infer<typeof stageSchema>;
export type WorkspaceConfigCustomField = z.infer<typeof customFieldSchema>;

/** Validate an untrusted/normalized config. Throws ZodError on failure. */
export function validateWorkspaceConfig(input: unknown): WorkspaceConfig {
  return workspaceConfigSchema.parse(input);
}
