// Registry mapping each step key to its handler. Auto handlers return
// done/blocked/failed; manual handlers always return `blocked` with task content
// (the engine presents it and waits for the operator). `intake` is seeded done
// and needs no handler. An auto step with no handler here blocks cleanly with a
// "not implemented" note (engine safety net).

import type { StepKey } from "@/lib/setup/pipeline";
import type { StepHandler } from "./types";
import { generateConfigHandler } from "./generate-config";
import { generatePromptHandler } from "./generate-prompt";
import { qaReviewHandler } from "./qa-review";
import { provisionVoiceHandler } from "./provision-voice";
import { provisionCalcomHandler } from "./provision-calcom";
import { provisionTwilioHandler } from "./provision-twilio";
import { registerN8nHandler } from "./register-n8n";
import { forwardingHandler } from "./forwarding";
import { a2pHandler } from "./a2p";
import { trustCheckHandler } from "./trust-check";
import { goLiveHandler } from "./go-live";

export const STEP_HANDLERS: Partial<Record<StepKey, StepHandler>> = {
  // Phase 1 — brain
  generate_config: generateConfigHandler,
  generate_prompt: generatePromptHandler,
  qa_review: qaReviewHandler,
  // Phase 2 — provisioning (auto)
  provision_voice: provisionVoiceHandler,
  provision_calcom: provisionCalcomHandler,
  provision_twilio: provisionTwilioHandler,
  register_n8n: registerN8nHandler,
  go_live: goLiveHandler,
  // Phase 2 — human task walls (manual)
  forwarding: forwardingHandler,
  a2p: a2pHandler,
  trust_check: trustCheckHandler,
};

export type { StepHandler, StepContext, StepOutcome } from "./types";
