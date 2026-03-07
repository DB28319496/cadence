import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireAutomations } from "@/lib/automation-engine";
import { z } from "zod";

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

  return NextResponse.json({ success: true });
}
