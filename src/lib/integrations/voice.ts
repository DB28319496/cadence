// Common voice-provider interface. Retell and Vapi are interchangeable behind
// it; the provider is chosen per client (config.voice_provider, else env
// SWITCHBOARD_VOICE_PROVIDER, else retell).

export interface AgentFunction {
  name: "check_availability" | "create_booking" | "notify_owner";
  description: string;
  /** n8n broker URL this function calls. */
  url: string;
}

export interface CreateAgentInput {
  name: string;
  systemPrompt: string;
  voice: string | null;
  webhookUrl: string;
  functions: AgentFunction[];
  /** Stable key so a retry reuses the same agent instead of creating a new one. */
  idempotencyKey: string;
}

export interface VoiceProvider {
  readonly name: "retell" | "vapi";
  createAgent(input: CreateAgentInput): Promise<{ agentId: string }>;
  setLive(agentId: string): Promise<void>;
}

export type VoiceProviderName = "retell" | "vapi";

export function resolveProviderName(config: Record<string, unknown>): VoiceProviderName {
  const fromConfig = config.voice_provider;
  if (fromConfig === "retell" || fromConfig === "vapi") return fromConfig;
  const fromEnv = process.env.SWITCHBOARD_VOICE_PROVIDER;
  if (fromEnv === "retell" || fromEnv === "vapi") return fromEnv;
  return "retell";
}
