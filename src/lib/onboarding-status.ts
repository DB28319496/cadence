// Lightweight job-status channel for the async onboarding flow. Uses Upstash
// Redis when configured (production); no-ops otherwise (local dev), in which
// case the client falls back to polling `workspace.onboardingCompleted` with a
// timeout. Kept Prisma-free so it can be used from any context.

import { Redis } from "@upstash/redis";

export type OnboardingStatus = "processing" | "done" | "failed";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const key = (workspaceId: string) => `onboarding:status:${workspaceId}`;

export async function setOnboardingStatus(
  workspaceId: string,
  status: OnboardingStatus
): Promise<void> {
  if (!redis) return;
  try {
    // Expire after 15 min — covers a slow generation, then cleans itself up.
    await redis.set(key(workspaceId), status, { ex: 900 });
  } catch {
    // status is best-effort; the client also polls onboardingCompleted
  }
}

export async function getOnboardingStatus(
  workspaceId: string
): Promise<OnboardingStatus | null> {
  if (!redis) return null;
  try {
    return (await redis.get<OnboardingStatus>(key(workspaceId))) ?? null;
  } catch {
    return null;
  }
}
