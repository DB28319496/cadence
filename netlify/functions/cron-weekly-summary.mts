import type { Config } from "@netlify/functions";

export const config: Config = {
  schedule: "0 9 * * 1", // Every Monday at 9 AM UTC
};

export default async function handler() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!baseUrl || !secret) {
    console.error("[cron-weekly-summary] Missing NEXT_PUBLIC_APP_URL or CRON_SECRET");
    return;
  }

  const res = await fetch(`${baseUrl}/api/cron/weekly-summary`, {
    headers: { authorization: `Bearer ${secret}` },
  });

  const body = await res.json();
  console.log("[cron-weekly-summary]", body);
}
