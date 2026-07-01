// n8n registration: upsert the client row so existing n8n flows serve this
// client_id. Posts the non-secret config to an n8n admin webhook. Gated behind
// N8N_ADMIN_URL; stub otherwise.

import { provisionStubEnabled, IntegrationError } from "./stub";

const KEY_ENV = "N8N_ADMIN_URL";

export interface N8nResult {
  clientId: string;
  registered: true;
}

export async function upsertClient(
  config: Record<string, unknown>,
  clientId: string
): Promise<N8nResult> {
  if (provisionStubEnabled(KEY_ENV)) {
    return { clientId, registered: true };
  }

  const res = await fetch(process.env.N8N_ADMIN_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.N8N_ADMIN_TOKEN
        ? { Authorization: `Bearer ${process.env.N8N_ADMIN_TOKEN}` }
        : {}),
    },
    // client_id keys the row; the rest is non-secret business data the flows read.
    body: JSON.stringify({ client_id: clientId, config }),
  });
  if (!res.ok) {
    throw new IntegrationError(`n8n upsert failed: ${res.status} ${await res.text()}`);
  }
  return { clientId, registered: true };
}
