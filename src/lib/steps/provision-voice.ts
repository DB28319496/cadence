import { getVoiceProvider } from "@/lib/integrations/voice-registry";
import { mergeClientConfig, readConfig } from "@/lib/setup/config-store";
import type { AgentFunction } from "@/lib/integrations/voice";
import type { StepHandler } from "./types";

const brokerUrl = (fn: string) => {
  const base = (process.env.N8N_BROKER_URL ?? "https://n8n.local/webhook").replace(/\/$/, "");
  return `${base}/${fn}`;
};
const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");

export const provisionVoiceHandler: StepHandler = async ({ client, step }) => {
  // Idempotency: an existing agentId means a prior attempt already created it.
  const prior = step.result as { agentId?: string } | null;
  if (prior?.agentId) return { status: "done", result: prior };

  if (!client.systemPrompt) {
    return { status: "failed", result: { error: "No system prompt; run generate_prompt first." } };
  }

  const config = readConfig(client.config);
  const provider = getVoiceProvider(config);
  const functions: AgentFunction[] = [
    { name: "check_availability", description: "Check open appointment slots.", url: brokerUrl("check_availability") },
    { name: "create_booking", description: "Create a booking on the calendar.", url: brokerUrl("create_booking") },
    { name: "notify_owner", description: "Notify the owner of a hot job / escalation.", url: brokerUrl("notify_owner") },
  ];

  const { agentId } = await provider.createAgent({
    name: client.businessName,
    systemPrompt: client.systemPrompt,
    voice: (config.voice as string | null) ?? null,
    webhookUrl: `${appUrl()}/api/setup/voice-webhook`,
    functions,
    idempotencyKey: client.id,
  });

  await mergeClientConfig(client.id, { agent_id: agentId, voice_provider: provider.name });
  return { status: "done", result: { agentId, provider: provider.name } };
};
