// Retell voice provider. Live REST calls are gated behind RETELL_API_KEY; when
// absent (or SWITCHBOARD_PROVISION_STUB=true) it returns a deterministic stub
// agent id so the pipeline runs offline.
//
// NOTE: the live request shapes below follow Retell's documented API but are
// UNVERIFIED against a live account here — confirm against current Retell docs
// before relying on them in production. The orchestration, idempotency, and stub
// path are what this project tests.

import { provisionStubEnabled, stubId, IntegrationError } from "./stub";
import type { CreateAgentInput, VoiceProvider } from "./voice";

const BASE = "https://api.retellai.com";
const KEY_ENV = "RETELL_API_KEY";

async function retellFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new IntegrationError(`Retell ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export const retell: VoiceProvider = {
  name: "retell",

  async createAgent(input: CreateAgentInput): Promise<{ agentId: string }> {
    if (provisionStubEnabled(KEY_ENV)) {
      return { agentId: stubId("agent_retell", input.idempotencyKey) };
    }

    // Retell models the prompt as a "Retell LLM" object, then an agent bound to it.
    const llm = (await retellFetch("/create-retell-llm", {
      general_prompt: input.systemPrompt,
      general_tools: input.functions.map((f) => ({
        type: "custom",
        name: f.name,
        description: f.description,
        url: f.url,
      })),
    })) as { llm_id: string };

    const agent = (await retellFetch("/create-agent", {
      agent_name: input.name,
      response_engine: { type: "retell-llm", llm_id: llm.llm_id },
      voice_id: input.voice ?? "11labs-Adrian",
      webhook_url: input.webhookUrl,
    })) as { agent_id: string };

    return { agentId: agent.agent_id };
  },

  async setLive(agentId: string): Promise<void> {
    if (provisionStubEnabled(KEY_ENV)) return;
    await retellFetch(`/update-agent/${agentId}`, { is_published: true });
  },
};
