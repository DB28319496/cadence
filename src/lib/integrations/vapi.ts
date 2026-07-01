// Vapi voice provider — interchangeable with retell.ts behind VoiceProvider.
// Live calls gated behind VAPI_API_KEY; stub otherwise. Live request shapes
// follow Vapi's documented API but are UNVERIFIED here — confirm before prod.

import { provisionStubEnabled, stubId, IntegrationError } from "./stub";
import type { CreateAgentInput, VoiceProvider } from "./voice";

const BASE = "https://api.vapi.ai";
const KEY_ENV = "VAPI_API_KEY";

async function vapiFetch(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new IntegrationError(`Vapi ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export const vapi: VoiceProvider = {
  name: "vapi",

  async createAgent(input: CreateAgentInput): Promise<{ agentId: string }> {
    if (provisionStubEnabled(KEY_ENV)) {
      return { agentId: stubId("agent_vapi", input.idempotencyKey) };
    }

    const assistant = (await vapiFetch("/assistant", "POST", {
      name: input.name,
      model: {
        provider: "anthropic",
        messages: [{ role: "system", content: input.systemPrompt }],
        tools: input.functions.map((f) => ({
          type: "function",
          function: { name: f.name, description: f.description },
          server: { url: f.url },
        })),
      },
      voice: input.voice ? { provider: "11labs", voiceId: input.voice } : undefined,
      serverUrl: input.webhookUrl,
    })) as { id: string };

    return { agentId: assistant.id };
  },

  async setLive(agentId: string): Promise<void> {
    if (provisionStubEnabled(KEY_ENV)) return;
    // Vapi assistants are live on create; nothing to flip. No-op for parity.
    void agentId;
  },
};
