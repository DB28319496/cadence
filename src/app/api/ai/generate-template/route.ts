import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireWorkspace } from "@/lib/api-helpers";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const schema = z.object({
  description: z.string().min(1),
  type: z.string().optional(),
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

  const { description, type } = parsed.data;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are an expert at writing professional client-facing emails for service businesses.

Generate an email template for: ${description}
Email type: ${type || "CUSTOM"}
Business name: ${workspace.name}

Available merge fields you MUST use where relevant: {{client_name}}, {{workspace_name}}, {{stage_name}}, {{project_type}}, {{portal_url}}

Return ONLY a valid JSON object with this exact structure, no explanation or markdown:
{"subject":"email subject line","body":"full HTML email body"}

Requirements:
- Body must be clean HTML with a <p> greeting, 2-3 body paragraphs, and a sign-off
- Use a warm, professional tone appropriate for a service business
- Use merge fields naturally in the copy`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(match?.[0] ?? text);
    if (!result.subject || !result.body) throw new Error("Missing fields");
    return NextResponse.json({ subject: result.subject as string, body: result.body as string });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }
}
