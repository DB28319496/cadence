import { NextRequest, NextResponse } from "next/server";
import { generatedToWorkspaceConfig, type GeneratedWorkspace } from "@/lib/onboarding-ai";
import {
  validateWorkspaceConfig,
  persistWorkspaceConfig,
} from "@/lib/workspace-setup";
import { setOnboardingStatus } from "@/lib/onboarding-status";

// Internal endpoint — called only by the onboarding background function with
// the shared CRON_SECRET. Validates the AI-generated config and persists it.
// No user session: trust is established by the secret.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { workspaceId, secret, ok, generated } = body as {
    workspaceId?: string;
    secret?: string;
    ok?: boolean;
    generated?: GeneratedWorkspace;
  };

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  // Generation failed upstream — record it so the client stops polling.
  if (!ok || !generated) {
    await setOnboardingStatus(workspaceId, "failed");
    return NextResponse.json({ ok: false });
  }

  try {
    const config = validateWorkspaceConfig(generatedToWorkspaceConfig(generated));
    await persistWorkspaceConfig(workspaceId, config);
    await setOnboardingStatus(workspaceId, "done");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Onboarding finalize] failed:", err);
    await setOnboardingStatus(workspaceId, "failed");
    return NextResponse.json({ error: "Failed to finalize workspace" }, { status: 500 });
  }
}
