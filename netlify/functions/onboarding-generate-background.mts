// Netlify Background Function (filename ends in "-background" → runs async,
// up to 15 min, returns 202 immediately). This is where the slow Claude call
// lives so it never hits the synchronous function timeout.
//
// It does ONLY the AI work (extract + generate), then POSTs the raw result to
// the internal /api/onboarding/finalize route, which validates + persists with
// Prisma. Keeping Prisma out of this standalone bundle avoids query-engine
// bundling headaches; this function only needs the Anthropic SDK.

import {
  extractOnboardingAnswers,
  generateWorkspaceFromAnswers,
  type OnboardingAnswers,
} from "../../src/lib/onboarding-ai";

type Payload = {
  workspaceId: string;
  kind: "answers" | "text";
  answers?: OnboardingAnswers;
  text?: string;
  origin: string;
  secret: string;
};

export default async (req: Request) => {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const { workspaceId, kind, answers, text, origin, secret } = body;

  // Internal endpoint — only callable with the shared secret.
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const finalize = (payload: Record<string, unknown>) =>
    fetch(`${origin}/api/onboarding/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, secret: process.env.CRON_SECRET, ...payload }),
    }).catch((err) => console.error("[onboarding-bg] finalize call failed:", err));

  try {
    let resolvedAnswers = answers;
    if (kind === "text") {
      if (!text) throw new Error("no text provided");
      resolvedAnswers = (await extractOnboardingAnswers(text)) ?? undefined;
      if (!resolvedAnswers) throw new Error("extraction returned null");
    }
    if (!resolvedAnswers) throw new Error("no answers to generate from");

    const generated = await generateWorkspaceFromAnswers(resolvedAnswers);
    if (!generated) throw new Error("generation returned null");

    await finalize({ ok: true, generated });
  } catch (err) {
    console.error("[onboarding-bg] failed:", err);
    await finalize({ ok: false });
  }
};
