import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWorkspace } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const { userId, error } = await requireAuth();
  if (error) return error;
  const { workspace, error: wsError } = await requireWorkspace(userId);
  if (wsError) return wsError;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: workspace.id },
    include: {
      currentStage: { select: { name: true, daysExpected: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { title: true, type: true },
      },
    },
  });

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const daysInStage = Math.floor(
    (Date.now() - new Date(client.stageEnteredAt).getTime()) / 86_400_000
  );
  const isOverdue =
    client.currentStage?.daysExpected != null &&
    daysInStage > client.currentStage.daysExpected;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Write a 2-3 sentence status summary for this client. Be specific and actionable for the account manager. No fluff.

Client: ${client.name}
Status: ${client.status}
Stage: ${client.currentStage?.name ?? "None"} — ${daysInStage} days${isOverdue ? ` (${daysInStage - (client.currentStage?.daysExpected ?? 0)}d OVERDUE)` : ""}
Project Type: ${client.projectType ?? "N/A"}
Project Value: ${client.projectValue ? `$${client.projectValue.toLocaleString()}` : "N/A"}
Notes: ${client.notes ?? "None"}
Recent activity: ${client.activities.map((a) => a.title).join("; ") || "None"}`,
      },
    ],
  });

  const summary = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return NextResponse.json({ summary });
}
