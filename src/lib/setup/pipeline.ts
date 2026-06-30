// The fixed, ordered Switchboard provisioning pipeline. One `OnboardingRun` per
// client walks these 12 steps as a state machine. `auto` steps run via a handler
// in the engine; `manual` steps block the run and render an operator task.
//
// This list is the single source of truth for step order, types, and labels —
// used by the seeder (creating ProvisioningStep rows), the engine, and the UI.

export type StepType = "auto" | "manual";

export type StepKey =
  | "intake"
  | "generate_config"
  | "generate_prompt"
  | "qa_review"
  | "provision_voice"
  | "provision_calcom"
  | "provision_twilio"
  | "register_n8n"
  | "forwarding"
  | "a2p"
  | "trust_check"
  | "go_live";

export type StepStatus =
  | "pending"
  | "running"
  | "done"
  | "blocked"
  | "failed"
  | "skipped";

export type RunStatus = "draft" | "running" | "blocked" | "live" | "failed";

export interface PipelineStepDef {
  key: StepKey;
  type: StepType;
  label: string;
  /** One-line description shown in the console. */
  description: string;
}

export const PIPELINE: readonly PipelineStepDef[] = [
  {
    key: "intake",
    type: "manual",
    label: "Intake",
    description: "Operator submits the intake (paste-a-doc or form).",
  },
  {
    key: "generate_config",
    type: "auto",
    label: "Generate config",
    description: "LLM turns intake into a structured client config; blocks if required fields are missing.",
  },
  {
    key: "generate_prompt",
    type: "auto",
    label: "Generate prompt",
    description: "LLM fills the vertical agent system prompt with real values.",
  },
  {
    key: "qa_review",
    type: "auto",
    label: "QA review",
    description: "LLM go/no-go reliability review; blocks on no-go.",
  },
  {
    key: "provision_voice",
    type: "auto",
    label: "Provision voice agent",
    description: "Create the Retell/Vapi agent, prompt, voice, functions, and webhook.",
  },
  {
    key: "provision_calcom",
    type: "auto",
    label: "Provision Cal.com",
    description: "Create event types per service, availability, and timezone.",
  },
  {
    key: "provision_twilio",
    type: "auto",
    label: "Provision Twilio number",
    description: "Buy the agent number near the client and attach it to the agent.",
  },
  {
    key: "register_n8n",
    type: "auto",
    label: "Register n8n",
    description: "Upsert the client row so existing n8n flows serve this client_id.",
  },
  {
    key: "forwarding",
    type: "manual",
    label: "Call forwarding",
    description: "Client sets no-answer / after-hours forwarding on their carrier to the agent number.",
  },
  {
    key: "a2p",
    type: "manual",
    label: "A2P 10DLC",
    description: "Register the A2P brand + campaign (needs client EIN); poll for approval, then auto-advance.",
  },
  {
    key: "trust_check",
    type: "manual",
    label: "Trust check",
    description: "Operator places real test calls and runs the 12-case script.",
  },
  {
    key: "go_live",
    type: "auto",
    label: "Go live",
    description: "Flip the agent live and set a 48-hour watch flag.",
  },
] as const;

export const STEP_KEYS: StepKey[] = PIPELINE.map((s) => s.key);

const ORDER = new Map<StepKey, number>(PIPELINE.map((s, i) => [s.key, i]));

export function stepOrder(key: string): number {
  return ORDER.get(key as StepKey) ?? Number.MAX_SAFE_INTEGER;
}

export function getStepDef(key: string): PipelineStepDef | undefined {
  return PIPELINE.find((s) => s.key === key);
}
