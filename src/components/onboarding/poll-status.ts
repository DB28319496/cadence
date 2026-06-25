// Polls /api/onboarding/status while an async (serverless) generation runs.
// Returns when the workspace is built, generation failed, or we give up.

export type PollResult = "done" | "failed" | "timeout";

export async function pollOnboardingStatus(opts?: {
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<PollResult> {
  const intervalMs = opts?.intervalMs ?? 3000;
  // Generation runs ~60-90s; allow generous headroom before giving up.
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const res = await fetch("/api/onboarding/status");
      if (res.ok) {
        const json = (await res.json()) as { done?: boolean; failed?: boolean };
        if (json.done) return "done";
        if (json.failed) return "failed";
      }
    } catch {
      // transient — keep polling
    }
  }
  return "timeout";
}
