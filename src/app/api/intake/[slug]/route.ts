import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireAutomations } from "@/lib/automation-engine";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";



const submitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, brandColor: true, intakeEnabled: true },
  });

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!workspace.intakeEnabled) return NextResponse.json({ error: "Intake form is not enabled" }, { status: 403 });

  return NextResponse.json({ name: workspace.name, brandColor: workspace.brandColor });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, name: true, brandColor: true, intakeEnabled: true, emailFromName: true, emailReplyTo: true, portalEnabled: true },
  });

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!workspace.intakeEnabled) return NextResponse.json({ error: "Intake form is not enabled" }, { status: 403 });

  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, phone, companyName, projectType, notes } = parsed.data;

  const client = await prisma.client.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      companyName: companyName || null,
      projectType: projectType || null,
      notes: notes || null,
      source: "INTAKE",
      workspaceId: workspace.id,
    },
  });

  await prisma.activity.create({
    data: {
      type: "CLIENT_CREATED",
      title: "Client submitted intake form",
      clientId: client.id,
    },
  });

  fireAutomations({ type: "CLIENT_CREATED" }, client, workspace).catch(console.error);

  // AI Intake Classifier — suggest best stage (non-blocking)
  if (process.env.ANTHROPIC_API_KEY && (projectType || notes)) {
    classifyIntake(client.id, workspace.id, workspace.name, projectType ?? null, notes ?? null).catch(
      console.error
    );
  }

  return NextResponse.json({ success: true });
}

async function classifyIntake(
  clientId: string,
  workspaceId: string,
  workspaceName: string,
  projectType: string | null,
  notes: string | null
) {
  // Get default pipeline stages
  const pipeline = await prisma.pipeline.findFirst({
    where: { workspaceId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } } },
  });
  if (!pipeline || pipeline.stages.length === 0) return;

  const stageList = pipeline.stages.map((s) => `${s.order + 1}. ${s.name}`).join("\n");

  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: `Given these pipeline stages for ${workspaceName}:
${stageList}

A new client submitted an intake form:
Project type: ${projectType ?? "Not specified"}
Notes: ${notes ?? "None"}

Which stage number should this client start in? Reply with ONLY the stage number (e.g. "2"). Default to 1 if uncertain.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "1";
  const stageIndex = parseInt(text.match(/\d+/)?.[0] ?? "1", 10) - 1;
  const stage = pipeline.stages[Math.max(0, Math.min(stageIndex, pipeline.stages.length - 1))];

  if (!stage || stage.order === 0) {
    // Already in first stage or couldn't determine — just log suggestion
    await prisma.activity.create({
      data: {
        type: "NOTE_ADDED",
        title: `AI intake classifier: starting in "${stage?.name ?? pipeline.stages[0].name}"`,
        clientId,
      },
    });
    return;
  }

  // Move client to suggested stage
  await prisma.client.update({
    where: { id: clientId },
    data: { currentStageId: stage.id, pipelineId: pipeline.id, stageEnteredAt: new Date() },
  });

  await prisma.activity.create({
    data: {
      type: "STAGE_CHANGE",
      title: `AI classified intake → "${stage.name}" based on project details`,
      clientId,
    },
  });
}
