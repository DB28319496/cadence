import type { Config } from "@netlify/functions";

// Runs daily at 8:00 AM UTC — checks all active clients for TIME_IN_STAGE automations
export default async () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL;
  if (!baseUrl) {
    console.error("[cron] NEXT_PUBLIC_APP_URL not set");
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/check-automations`, {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });
    const data = await res.json();
    console.log("[cron] check-automations result:", data);
  } catch (err) {
    console.error("[cron] failed:", err);
  }
};

export const config: Config = {
  schedule: "0 8 * * *", // daily at 8:00 AM UTC
};
