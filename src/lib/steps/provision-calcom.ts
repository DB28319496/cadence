import { createEventTypes } from "@/lib/integrations/calcom";
import { mergeClientConfig, readConfig } from "@/lib/setup/config-store";
import type { StepHandler } from "./types";

export const provisionCalcomHandler: StepHandler = async ({ client, step }) => {
  const config = readConfig(client.config);
  // Idempotency: reuse already-created event types, only create the missing ones.
  const prior = step.result as { eventTypeIds?: Record<string, string> } | null;
  const existing = prior?.eventTypeIds ?? {};

  const { eventTypeIds } = await createEventTypes(config, client.id, existing);

  await mergeClientConfig(client.id, { event_type_ids: eventTypeIds });
  return { status: "done", result: { eventTypeIds } };
};
