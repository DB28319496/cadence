// Bridges the onboarding API routes to the async background function.
//
// On serverless (Netlify) the synchronous Claude call (~84s) exceeds the
// function timeout, so generation is offloaded to a background function. On
// other hosts (local dev, long-running servers) the routes run generation
// inline instead — see `runsAsync`.

import type { OnboardingAnswers } from "@/lib/onboarding-ai";
import { setOnboardingStatus } from "@/lib/onboarding-status";

/**
 * True when AI generation must be offloaded to the background function
 * (serverless function timeout). Driven by an explicit env var set in Netlify
 * (ONBOARDING_ASYNC=true) because process.env.NETLIFY isn't reliably present at
 * function runtime. Falls back to NETLIFY/VERCEL detection.
 */
export function runsAsync(): boolean {
  return (
    process.env.ONBOARDING_ASYNC === "true" ||
    !!process.env.NETLIFY ||
    !!process.env.VERCEL
  );
}

/** Public origin of the current deploy, for calling same-host endpoints. */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

type TriggerParams =
  | { workspaceId: string; origin: string; kind: "answers"; answers: OnboardingAnswers }
  | { workspaceId: string; origin: string; kind: "text"; text: string };

/** Mark the workspace as processing and kick off the background function. */
export async function triggerBackgroundGeneration(params: TriggerParams): Promise<void> {
  await setOnboardingStatus(params.workspaceId, "processing");
  await fetch(`${params.origin}/.netlify/functions/onboarding-generate-background`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, secret: process.env.CRON_SECRET }),
  });
}
