import { z } from "zod";

// The Switchboard client config object. The LLM produces this from intake; we
// validate it with zod before persisting (never trust raw model text). Inner
// shapes are intentionally permissive — intake quality varies — but the two
// load-bearing fields (business_name, vertical) are strict, and `vertical` is a
// closed enum. Unknown-but-required fields come back as `null` and are listed
// in the separate `missing` array so the engine can block.

export const VERTICALS = ["auto", "hvac", "home_services"] as const;
export type Vertical = (typeof VERTICALS)[number];

const stringOrNull = z.string().nullable();
const anyOrNull = z.unknown().nullable();

export const switchboardConfigSchema = z
  .object({
    client_id: z.string().nullable().optional(),
    business_name: z.string().min(1, "business_name is required"),
    vertical: z.enum(VERTICALS),
    city: stringOrNull,
    service_area: anyOrNull,
    hours: anyOrNull,
    services: anyOrNull,
    price_ranges: anyOrNull,
    booking_fields: anyOrNull,
    faqs: anyOrNull,
    hot_job_rules: anyOrNull,
    escalation: anyOrNull,
    avg_ticket: anyOrNull,
    service_value_map: anyOrNull,
    calendar_id: stringOrNull,
    owner_phone: stringOrNull,
    business_number: stringOrNull,
    agent_number: stringOrNull,
    voice: stringOrNull,
    greeting: stringOrNull,
  })
  // Keep any extra non-secret IDs the provisioning steps write back later
  // (e.g. agentId, eventTypeIds) without failing validation.
  .loose();

export type SwitchboardConfig = z.infer<typeof switchboardConfigSchema>;

/** The full result the config generator returns: validated config + gaps. */
export const generateConfigResultSchema = z.object({
  config: switchboardConfigSchema,
  missing: z.array(z.string()).default([]),
});

export type GenerateConfigResult = z.infer<typeof generateConfigResultSchema>;

export const qaFlagSchema = z.object({
  risk: z.string(),
  fix: z.string(),
});

export const qaReviewResultSchema = z.object({
  verdict: z.enum(["go", "no-go"]),
  flags: z.array(qaFlagSchema).default([]),
});

export type QaFlag = z.infer<typeof qaFlagSchema>;
export type QaReviewResult = z.infer<typeof qaReviewResultSchema>;

/** The config keys we expect a complete intake to fill (for the LLM prompt). */
export const REQUIRED_CONFIG_KEYS = [
  "business_name",
  "vertical",
  "city",
  "hours",
  "services",
  "booking_fields",
  "hot_job_rules",
  "escalation",
  "owner_phone",
  "business_number",
  "greeting",
] as const;
