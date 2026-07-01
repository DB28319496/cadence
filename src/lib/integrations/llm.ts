// Typed wrapper over the Anthropic SDK for the three "brain" steps of the
// Switchboard setup engine: generateConfig, generatePrompt, qaReview.
//
// - Models come from env (ANTHROPIC_MODEL, ANTHROPIC_QA_MODEL); QA defaults to a
//   stronger model when set, else the base model.
// - Every structured result is schema-validated (zod) before it leaves here —
//   we never trust raw model text.
// - Stub mode (SWITCHBOARD_LLM_STUB=true) returns deterministic output so Phase 1
//   is fully testable with zero API keys. The Anthropic key is also IP-allowlisted
//   in this project, so the stub is the reliable local path.

import Anthropic from "@anthropic-ai/sdk";
import {
  switchboardConfigSchema,
  generateConfigResultSchema,
  qaReviewResultSchema,
  VERTICALS,
  type Vertical,
  type SwitchboardConfig,
  type GenerateConfigResult,
  type QaReviewResult,
} from "@/lib/setup/config-schema";
import { getAgentTemplate, getVerticalDefaults } from "@/lib/templates/agent";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const QA_MODEL = process.env.ANTHROPIC_QA_MODEL || MODEL;
const STUB = process.env.SWITCHBOARD_LLM_STUB === "true";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/** Thrown when the LLM is needed but unavailable/unparseable. Engine -> failed. */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

function requireClient(): Anthropic {
  if (!client) {
    throw new LlmError(
      "ANTHROPIC_API_KEY not configured. Set it, or set SWITCHBOARD_LLM_STUB=true for offline runs."
    );
  }
  return client;
}

/** Pull the single forced tool_use input out of a messages response. */
function toolInput(response: Anthropic.Message): unknown {
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new LlmError("Model did not return the expected structured output.");
  }
  return block.input;
}

// ── generateConfig ──────────────────────────────────────────────────────────

const CONFIG_KEYS = [
  "client_id",
  "business_name",
  "vertical",
  "city",
  "service_area",
  "hours",
  "services",
  "price_ranges",
  "booking_fields",
  "faqs",
  "hot_job_rules",
  "escalation",
  "avg_ticket",
  "service_value_map",
  "calendar_id",
  "owner_phone",
  "business_number",
  "agent_number",
  "voice",
  "greeting",
];

const CONFIG_TOOL: Anthropic.Tool = {
  name: "emit_client_config",
  description:
    "Emit the Switchboard client config object plus a list of required fields that could not be filled.",
  input_schema: {
    type: "object",
    properties: {
      config: {
        type: "object",
        description: "The client config. Unknown fields must be null, not invented.",
        properties: {
          business_name: { type: "string" },
          vertical: { type: "string", enum: [...VERTICALS] },
          city: { type: ["string", "null"] },
          service_area: { type: ["string", "null"] },
          hours: { type: ["string", "object", "null"] },
          services: { type: ["array", "string", "null"] },
          price_ranges: { type: ["object", "string", "null"] },
          booking_fields: { type: ["array", "null"] },
          faqs: { type: ["array", "object", "string", "null"] },
          hot_job_rules: { type: ["array", "null"] },
          escalation: { type: ["string", "object", "null"] },
          avg_ticket: { type: ["number", "string", "null"] },
          service_value_map: { type: ["object", "null"] },
          calendar_id: { type: ["string", "null"] },
          owner_phone: { type: ["string", "null"] },
          business_number: { type: ["string", "null"] },
          agent_number: { type: ["string", "null"] },
          voice: { type: ["string", "null"] },
          greeting: { type: ["string", "null"] },
        },
        required: ["business_name", "vertical"],
      },
      missing: {
        type: "array",
        items: { type: "string" },
        description: "Names of required fields that the intake did not provide.",
      },
    },
    required: ["config", "missing"],
  },
};

const CONFIG_SYSTEM = `You convert a raw intake (notes or a form dump) for a local service business into a structured Switchboard client config, by calling emit_client_config.

Rules:
- vertical must be one of: auto, hvac, home_services. Infer it from the business.
- Use the vertical's standard booking_fields and hot_job_rules UNLESS the intake clearly overrides them. The caller will supply the standard defaults; prefer them when the intake is silent.
- NEVER invent prices. If price ranges aren't given, set price_ranges to null and list "price_ranges" in missing only if pricing is essential.
- Any required field you cannot fill from the intake must be null in config AND listed in the missing array. Do not guess phone numbers, addresses, or hours.
- Keep config to the documented keys only. Output strictly via the tool.`;

export async function generateConfig(
  intakeText: string
): Promise<GenerateConfigResult> {
  if (STUB) return stubGenerateConfig(intakeText);

  const response = await requireClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: CONFIG_SYSTEM,
    tools: [CONFIG_TOOL],
    tool_choice: { type: "tool", name: CONFIG_TOOL.name },
    messages: [
      {
        role: "user",
        content: `Standard defaults by vertical (use when the intake is silent):
auto: ${JSON.stringify(getVerticalDefaults("auto"))}
hvac: ${JSON.stringify(getVerticalDefaults("hvac"))}
home_services: ${JSON.stringify(getVerticalDefaults("home_services"))}

Config keys (use exactly these): ${CONFIG_KEYS.join(", ")}

INTAKE:
${intakeText}`,
      },
    ],
  });

  const parsed = generateConfigResultSchema.safeParse(toolInput(response));
  if (!parsed.success) {
    throw new LlmError(`Config failed validation: ${parsed.error.issues[0]?.message}`);
  }
  return applyVerticalDefaults(parsed.data);
}

/** Fill null booking_fields / hot_job_rules from the vertical defaults. */
function applyVerticalDefaults(result: GenerateConfigResult): GenerateConfigResult {
  const vertical = result.config.vertical as Vertical;
  const defaults = getVerticalDefaults(vertical);
  const config = { ...result.config };
  let missing = [...result.missing];

  if (config.booking_fields == null) {
    config.booking_fields = defaults.booking_fields;
    missing = missing.filter((m) => m !== "booking_fields");
  }
  if (config.hot_job_rules == null) {
    config.hot_job_rules = defaults.hot_job_rules;
    missing = missing.filter((m) => m !== "hot_job_rules");
  }
  return { config, missing };
}

// ── generatePrompt ──────────────────────────────────────────────────────────

const PROMPT_SYSTEM = `You fill a vertical agent system-prompt template with real values from a client config.

Rules:
- Replace every {token} with the matching config value. Render arrays/objects as clean, human-readable text.
- Keep the section headers exactly as given: ROLE, DISCLOSURE, WHAT YOU KNOW, RULES, BOOKING FLOW, ESCALATION, CLOSING (plus any safety/triage block already in the template).
- If a value is missing, write a sensible neutral placeholder rather than leaving a literal {token}.
- Output ONLY the finished prompt text. No preamble, no commentary.`;

export async function generatePrompt(config: SwitchboardConfig): Promise<string> {
  const vertical = config.vertical as Vertical;
  const template = getAgentTemplate(vertical);
  if (STUB) return stubFillTemplate(template, config);

  const response = await requireClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: PROMPT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `TEMPLATE:
${template}

CONFIG (JSON):
${JSON.stringify(config, null, 2)}`,
      },
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!text) throw new LlmError("Prompt generation returned empty text.");
  return text;
}

// ── qaReview ────────────────────────────────────────────────────────────────

const QA_TOOL: Anthropic.Tool = {
  name: "emit_qa_review",
  description: "Emit a go/no-go reliability review of the agent prompt + config.",
  input_schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["go", "no-go"] },
      flags: {
        type: "array",
        description: "Every reliability risk found, each with a one-line fix.",
        items: {
          type: "object",
          properties: {
            risk: { type: "string" },
            fix: { type: "string" },
          },
          required: ["risk", "fix"],
        },
      },
    },
    required: ["verdict", "flags"],
  },
};

const QA_SYSTEM = `You QA a Switchboard AI front-desk agent before it goes live. List every reliability risk you find, each with a one-line fix. Then give a go/no-go.

Reserve "no-go" for issues that WILL cause a real failure on a live call:
- A safety branch missing or wrong (e.g. gas smell, unsafe-to-drive).
- Prices quoted as exact figures instead of ranges, or a price that contradicts the config.
- A booking field the calendar/booking flow requires but the prompt never collects.
- A hot-job or escalation condition that is left uncovered.
- A concrete scheduling error (e.g. hours that contradict themselves, or a genuine cross-timezone booking error).

Everything else is ADVISORY: still list it as a flag with a fix, but return "go". In particular, a missing FAQ (warranty, payment methods, service duration, etc.), a nice-to-have addition, or minor wording/timezone polish are NOT grounds for "no-go" on their own — the agent can escalate or take a message for anything it doesn't know.

Only return "no-go" when a caller would actually get a wrong booking, a bad price, or a safety miss. Output strictly via the tool.`;

export async function qaReview(
  prompt: string,
  config: SwitchboardConfig
): Promise<QaReviewResult> {
  if (STUB) return stubQaReview(prompt, config);

  const response = await requireClient().messages.create({
    model: QA_MODEL,
    max_tokens: 2000,
    system: QA_SYSTEM,
    tools: [QA_TOOL],
    tool_choice: { type: "tool", name: QA_TOOL.name },
    messages: [
      {
        role: "user",
        content: `AGENT PROMPT:
${prompt}

CONFIG (JSON):
${JSON.stringify(config, null, 2)}`,
      },
    ],
  });

  const parsed = qaReviewResultSchema.safeParse(toolInput(response));
  if (!parsed.success) {
    throw new LlmError(`QA review failed validation: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

// ── Deterministic stub implementations (offline / zero-key) ──────────────────

function detectVertical(text: string): Vertical {
  const t = text.toLowerCase();
  if (/hvac|furnace|boiler|heat pump|air condition|\bac\b|cooling|heating/.test(t)) {
    return "hvac";
  }
  if (/plumb|electric|handyman|home service|drain|sewage|wiring/.test(t)) {
    return "home_services";
  }
  return "auto";
}

function stubGenerateConfig(intakeText: string): GenerateConfigResult {
  const vertical = detectVertical(intakeText);
  const nameMatch = intakeText.match(/business(?:\s*name)?\s*[:\-]\s*(.+)/i);
  const business_name =
    (nameMatch?.[1] ?? intakeText.split("\n").map((l) => l.trim()).find(Boolean) ?? "Demo Service Co")
      .slice(0, 80)
      .trim();

  const wantMissing = intakeText.includes("[[MISSING]]");
  const wantNoGo = intakeText.includes("[[NOGO]]");

  const config = switchboardConfigSchema.parse({
    client_id: null,
    business_name,
    vertical,
    city: wantMissing ? null : "Springfield",
    service_area: "Greater Springfield metro",
    hours: wantMissing ? null : "Mon-Fri 8am-6pm, Sat 9am-1pm",
    services: ["Diagnostic", "Repair", "Maintenance"],
    price_ranges: wantMissing ? null : { Diagnostic: "$80-$120", Repair: "$150-$600" },
    booking_fields: null, // -> filled from vertical defaults
    faqs: [{ q: "Do you offer free estimates?", a: "Yes, on most jobs." }],
    hot_job_rules: null, // -> filled from vertical defaults
    escalation: "Warm-transfer to the owner during hours; take a message after hours.",
    avg_ticket: 320,
    service_value_map: { Repair: 400, Maintenance: 120 },
    calendar_id: null,
    owner_phone: wantMissing ? null : "+15555550100",
    business_number: "+15555550111",
    agent_number: null,
    // Sentinel the QA stub keys off of to exercise the no-go path deterministically.
    voice: wantNoGo ? "nogo" : "professional",
    greeting: "Thanks for calling, how can I help?",
  });

  const missing = wantMissing ? ["city", "hours", "price_ranges", "owner_phone"] : [];
  return applyVerticalDefaults({ config, missing });
}

function stubFillTemplate(template: string, config: SwitchboardConfig): string {
  const render = (v: unknown): string => {
    if (v == null) return "(to be confirmed)";
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("; ");
    if (typeof v === "object") {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => `${k}: ${typeof val === "string" ? val : JSON.stringify(val)}`)
        .join("; ");
    }
    return String(v);
  };
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    render((config as Record<string, unknown>)[key])
  );
}

function stubQaReview(_prompt: string, config: SwitchboardConfig): QaReviewResult {
  if (config.voice === "nogo") {
    return {
      verdict: "no-go",
      flags: [
        { risk: "Greeting/script flagged for review by stub sentinel.", fix: "Resolve the flagged config and re-run QA." },
        { risk: "Price ranges may be quoted too precisely.", fix: "Switch exact prices to ranges in price_ranges." },
      ],
    };
  }
  const flags = [];
  if (config.price_ranges == null) {
    flags.push({ risk: "No price ranges provided.", fix: "Add price_ranges so the agent can quote bands." });
  }
  if (config.faqs == null) {
    flags.push({ risk: "No FAQs captured.", fix: "Add the 3-5 most common caller questions." });
  }
  return { verdict: "go", flags };
}
