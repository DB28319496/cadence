import { upsertClient } from "@/lib/integrations/n8n";
import { readConfig } from "@/lib/setup/config-store";
import type { StepHandler } from "./types";

export const registerN8nHandler: StepHandler = async ({ client, step }) => {
  // Idempotent upsert — safe to repeat, but short-circuit if already registered.
  const prior = step.result as { registered?: boolean } | null;
  if (prior?.registered) return { status: "done", result: prior };

  const result = await upsertClient(readConfig(client.config), client.id);
  return { status: "done", result };
};
