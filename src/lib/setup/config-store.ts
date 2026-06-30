// Leaf module (imports only prisma) for merging non-secret external IDs back
// into SwitchboardClient.config — used by the provisioning step handlers. Kept
// separate from service.ts to avoid a handlers -> service -> engine -> handlers
// import cycle. NEVER write secrets here; config is non-secret data only.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SwitchboardConfig } from "@/lib/setup/config-schema";

export async function mergeClientConfig(
  clientId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const client = await prisma.switchboardClient.findUnique({
    where: { id: clientId },
    select: { config: true },
  });
  const current = (client?.config ?? {}) as Record<string, unknown>;
  const merged = { ...current, ...patch };
  await prisma.switchboardClient.update({
    where: { id: clientId },
    data: { config: merged as Prisma.InputJsonValue },
  });
  return merged;
}

export function readConfig(value: unknown): Partial<SwitchboardConfig> & Record<string, unknown> {
  return (value ?? {}) as Partial<SwitchboardConfig> & Record<string, unknown>;
}
