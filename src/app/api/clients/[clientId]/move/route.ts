import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWorkspace } from "@/lib/api-helpers";
import { fireAutomations } from "@/lib/automation-engine";

type Params = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const { session, userId, error } = await requireAuth();
  if (error) return error;
  const { workspace, error: wsError } = await requireWorkspace(userId);
  if (wsError) return wsError;

  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
    include: { currentStage: { select: { name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fromStageId = existing.currentStageId ?? undefined;
  const { stageId } = await req.json();
  if (!stageId) return NextResponse.json({ error: "stageId is required" }, { status: 400 });

  const stage = await prisma.stage.findFirst({
    where: { id: stageId },
    include: { pipeline: { select: { workspaceId: true } } },
  });
  if (!stage || stage.pipeline.workspaceId !== workspace.id) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const client = await prisma.client.update({
    where: { id: clientId },
    data: { currentStageId: stageId, stageEnteredAt: new Date() },
    include: {
      currentStage: { select: { id: true, name: true, color: true, daysExpected: true } },
      assignedTo: { select: { id: true, name: true, image: true } },
      stageCompletions: { select: { checklistItemId: true, stageId: true } },
    },
  });

  await prisma.activity.create({
    data: {
      type: "STAGE_CHANGE",
      title: `Moved from "${existing.currentStage?.name ?? "No stage"}" to "${stage.name}"`,
      clientId,
      userId,
    },
  });

  // Fire STAGE_ENTRY automation rules (non-blocking)
  // Enhancement 1: pass fromStageId for from/to stage matching
  fireAutomations(
    { type: "STAGE_ENTRY", stageId, fromStageId },
    { ...client, portalToken: client.portalToken ?? null, stageEnteredAt: client.stageEnteredAt ?? null },
    { ...workspace, portalEnabled: workspace.portalEnabled ?? false },
    stage.name
  ).catch(console.error);

  return NextResponse.json(client);
}
