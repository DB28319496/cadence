import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  // Don't mark as completed — we want the reminder banner to show on dashboard.
  // Just acknowledge the skip. The signup flow already seeded starter content.
  return NextResponse.json({ ok: true });
}
