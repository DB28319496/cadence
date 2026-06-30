import { getVoiceProvider } from "@/lib/integrations/voice-registry";
import { mergeClientConfig, readConfig } from "@/lib/setup/config-store";
import type { StepHandler } from "./types";

const WATCH_MS = 48 * 60 * 60 * 1000;

export const goLiveHandler: StepHandler = async ({ client }) => {
  const config = readConfig(client.config);
  const agentId = config.agent_id as string | undefined;

  // setLive is idempotent on the provider side — safe to call on a retry.
  if (agentId) {
    const provider = getVoiceProvider(config);
    await provider.setLive(agentId);
  }

  const watchUntil = new Date(Date.now() + WATCH_MS).toISOString();
  await mergeClientConfig(client.id, { watch_until: watchUntil });

  // The engine flips the client/run to `live` once this (final) step is done.
  return { status: "done", result: { live: true, agentId: agentId ?? null, watchUntil } };
};
