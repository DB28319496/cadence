// Minimal Upstash QStash publisher (REST, no SDK dep). Used to schedule the A2P
// status poll off the request path. When QSTASH_TOKEN is absent (or stub mode),
// `enqueueDelayed` reports "not enqueued" and the caller polls inline instead —
// which keeps local/test runs deterministic.

import { provisionStubEnabled } from "./stub";

const KEY_ENV = "QSTASH_TOKEN";

export function qstashAvailable(): boolean {
  return !provisionStubEnabled(KEY_ENV);
}

/** Publish a message to `url` to be delivered after `delaySeconds`. */
export async function enqueueDelayed(
  url: string,
  body: unknown,
  delaySeconds: number
): Promise<{ enqueued: boolean; messageId?: string }> {
  if (!qstashAvailable()) return { enqueued: false };

  const res = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(url)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      "Content-Type": "application/json",
      "Upstash-Delay": `${delaySeconds}s`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { enqueued: false };
  const data = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { enqueued: true, messageId: data.messageId };
}
