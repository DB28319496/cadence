import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOnboardingStatus } from "@/lib/onboarding-status";

// Polled by the onboarding UI while an async generation runs.
// done  → generation persisted (onboardingCompleted flipped true)
// failed → generation/extraction errored (client can stop and show a retry)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: { select: { id: true, onboardingCompleted: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!member) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const done = member.workspace.onboardingCompleted;
  const failed = !done && (await getOnboardingStatus(member.workspace.id)) === "failed";

  return NextResponse.json({ done, failed });
}
