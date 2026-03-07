import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireWorkspace } from "@/lib/api-helpers";
import { createClientSchema } from "@/lib/validations";
import { fireAutomations } from "@/lib/automation-engine";

export async function GET(req: NextRequest) {
  const { session, userId, error } = await requireAuth();
  if (error) return error;
  const { workspace, error: wsError } = await requireWorkspace(userId);
  if (wsError) return wsError;

  const { searchParams } = new URL(req.url);
  const pipelineId = searchParams.get("pipelineId");
  const stageId = searchParams.get("stageId");
  const status = searchParams.get("status");

  const clients = await prisma.client.findMany({
    where: {
      workspaceId: workspace.id,
      ...(pipelineId && { pipelineId }),
      ...(stageId && { currentStageId: stageId }),
      status: status ?? "ACTIVE",
    },
    include: {
      currentStage: {
        select: { id: true, name: true, color: true, daysExpected: true },
      },
      assignedTo: { select: { id: true, name: true, image: true } },
      stageCompletions: { select: { checklistItemId: true, stageId: true } },
    },
    orderBy: { stageEnteredAt: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const { session, userId, error } = await requireAuth();
  if (error) return error;
  const { workspace, error: wsError } = await requireWorkspace(userId);
  if (wsError) return wsError;

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { pipelineId, stageId: initialStageId, ...rest } = parsed.data;
  let currentStageId: string | undefined;
  let resolvedPipelineId = pipelineId;

  if (initialStageId) {
    // Caller specified an exact stage — find its pipeline
    const stage = await prisma.stage.findUnique({
      where: { id: initialStageId },
      select: { id: true, pipelineId: true },
    });
    currentStageId = stage?.id;
    resolvedPipelineId = stage?.pipelineId ?? pipelineId;
  } else if (pipelineId) {
    const firstStage = await prisma.stage.findFirst({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });
    currentStageId = firstStage?.id;
  } else {
    const defaultPipeline = await prisma.pipeline.findFirst({
      where: { workspaceId: workspace.id, isDefault: true },
      include: { stages: { orderBy: { order: "asc" }, take: 1 } },
    });
    if (defaultPipeline) {
      resolvedPipelineId = defaultPipeline.id;
      currentStageId = defaultPipeline.stages[0]?.id;
    }
  }

  const client = await prisma.client.create({
    data: {
      ...rest,
      email: rest.email || null,
      workspaceId: workspace.id,
      pipelineId: resolvedPipelineId,
      currentStageId,
    },
    include: {
      currentStage: { select: { id: true, name: true, color: true, daysExpected: true } },
      assignedTo: { select: { id: true, name: true, image: true } },
      stageCompletions: { select: { checklistItemId: true, stageId: true } },
    },
  });

  await prisma.activity.create({
    data: {
      type: "CLIENT_CREATED",
      title: `${client.name} was added`,
      clientId: client.id,
      userId,
    },
  });

  // Fire automation rules (non-blocking — don't fail the request if automation fails)
  fireAutomations(
    { type: "CLIENT_CREATED" },
    { ...client, portalToken: client.portalToken ?? null, stageEnteredAt: client.stageEnteredAt ?? null },
    { ...workspace, portalEnabled: workspace.portalEnabled ?? false }
  ).catch(console.error);

  return NextResponse.json(client, { status: 201 });
}
