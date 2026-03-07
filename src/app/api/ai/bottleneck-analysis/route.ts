import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWorkspace } from "@/lib/api-helpers";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  bottlenecks: z.array(
    z.object({
      name: z.string(),
      pipelineName: z.string(),
      clientCount: z.number(),
      overdueCount: z.number(),
      avgDays: z.number(),
      daysExpected: z.number().nullable(),
    })
  ),
});

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { userId, error } = await requireAuth();
  if (error) return error;
  const { workspace, error: wsError } = await requireWorkspace(userId);
  if (wsError) return wsError;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { bottlenecks } = parsed.data;
  const stageList = bottlenecks
    .map(
      (s) =>
        `- ${s.name} (${s.pipelineName}): ${s.clientCount} clients, ${s.overdueCount} overdue, avg ${s.avgDays}d${s.daysExpected ? ` vs ${s.daysExpected}d expected` : ""}`
    )
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `You are a business consultant analyzing a client onboarding pipeline for ${workspace.name}.

These pipeline stages have bottlenecks (clients taking longer than expected):
${stageList}

Provide 3-4 specific, actionable recommendations to fix these bottlenecks. Be concise and practical. Format as a numbered list. Focus on process improvements, not generic advice.`,
      },
    ],
  });

  const insights = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return NextResponse.json({ insights });
}
