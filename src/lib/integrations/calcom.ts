// Cal.com integration: one event type per bookable service, availability from
// hours + timezone. Live calls gated behind CALCOM_API_KEY; stub otherwise.
// Live shapes follow Cal.com v2 API but are UNVERIFIED here.

import { provisionStubEnabled, stubId, IntegrationError } from "./stub";

const BASE = "https://api.cal.com/v2";
const KEY_ENV = "CALCOM_API_KEY";

export interface CalcomResult {
  /** service name -> event type id */
  eventTypeIds: Record<string, string>;
}

function servicesOf(config: Record<string, unknown>): string[] {
  const s = config.services;
  if (Array.isArray(s)) return s.map(String).filter(Boolean);
  if (typeof s === "string") return s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  return ["General service"];
}

async function calFetch(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CALCOM_API_KEY}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new IntegrationError(`Cal.com ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Idempotent: pass `existing` (prior eventTypeIds from step.result) so already
 * created services are skipped and only new ones are created.
 */
export async function createEventTypes(
  config: Record<string, unknown>,
  clientId: string,
  existing: Record<string, string> = {}
): Promise<CalcomResult> {
  const eventTypeIds: Record<string, string> = { ...existing };

  for (const service of servicesOf(config)) {
    if (eventTypeIds[service]) continue; // already provisioned

    if (provisionStubEnabled(KEY_ENV)) {
      eventTypeIds[service] = stubId("evt", `${clientId}:${service}`);
      continue;
    }

    const created = (await calFetch("/event-types", {
      title: service,
      slug: service.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      lengthInMinutes: 60,
      // availability + timezone are derived server-side from the connected
      // schedule; hours/timezone from config are passed through metadata.
      metadata: { hours: config.hours ?? null, timezone: config.timezone ?? null },
    })) as { data: { id: number | string } };

    eventTypeIds[service] = String(created.data.id);
  }

  return { eventTypeIds };
}
