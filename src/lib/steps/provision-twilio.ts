import { buyNumber, attachNumberToAgent } from "@/lib/integrations/twilio";
import { mergeClientConfig, readConfig } from "@/lib/setup/config-store";
import type { StepHandler } from "./types";

export const provisionTwilioHandler: StepHandler = async ({ client, step }) => {
  // Idempotency: an existing phoneSid means the number was already bought.
  const prior = step.result as { phoneSid?: string; phoneNumber?: string } | null;
  if (prior?.phoneSid) return { status: "done", result: prior };

  const config = readConfig(client.config);
  const { phoneSid, phoneNumber } = await buyNumber(config, client.id);

  const agentId = config.agent_id as string | undefined;
  if (agentId) await attachNumberToAgent(phoneSid, agentId);

  await mergeClientConfig(client.id, { agent_number: phoneNumber });
  return { status: "done", result: { phoneSid, phoneNumber } };
};
