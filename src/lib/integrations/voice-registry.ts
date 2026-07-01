import { resolveProviderName, type VoiceProvider } from "./voice";
import { retell } from "./retell";
import { vapi } from "./vapi";

/** Pick the voice provider for a client (config.voice_provider | env | retell). */
export function getVoiceProvider(config: Record<string, unknown>): VoiceProvider {
  return resolveProviderName(config) === "vapi" ? vapi : retell;
}
