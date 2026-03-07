import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export type WorkspaceSummaryData = {
  workspaceName: string;
  weekStarting: string; // ISO date string
  activeClients: number;
  newClientsThisWeek: number;
  completedThisWeek: number;
  totalPipelineValue: number;
  stageBreakdown: { stageName: string; count: number; overdueCount: number }[];
  recentActivities: { clientName: string; description: string }[];
};

export async function generateWeeklySummaryEmail(
  data: WorkspaceSummaryData
): Promise<{ subject: string; html: string } | null> {
  if (!client) {
    console.log("[AI Summary] No ANTHROPIC_API_KEY — skipping AI generation");
    return null;
  }

  const prompt = `You are an assistant that writes concise weekly business summary emails for a client onboarding platform.

Given the following workspace data, write a short professional weekly summary email.

Workspace: ${data.workspaceName}
Week Starting: ${data.weekStarting}
Active Clients: ${data.activeClients}
New Clients This Week: ${data.newClientsThisWeek}
Completed This Week: ${data.completedThisWeek}
Total Pipeline Value: $${data.totalPipelineValue.toLocaleString()}

Stage Breakdown:
${data.stageBreakdown.map((s) => `- ${s.stageName}: ${s.count} clients${s.overdueCount > 0 ? ` (${s.overdueCount} overdue)` : ""}`).join("\n")}

Recent Activity Highlights:
${data.recentActivities.slice(0, 5).map((a) => `- ${a.clientName}: ${a.description}`).join("\n")}

Write a friendly, professional HTML email with:
1. A brief subject line (no more than 8 words)
2. HTML body with clear sections: Overview, Pipeline Status, Action Items (if any overdue clients)
3. Keep it concise — this is a quick executive summary, not a report
4. Use simple inline-styled HTML (no external CSS)

Return ONLY valid JSON in this exact format:
{"subject": "...", "html": "..."}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text.trim());
    if (typeof parsed.subject === "string" && typeof parsed.html === "string") {
      return parsed;
    }
    throw new Error("Invalid response shape from AI");
  } catch (err) {
    console.error("[AI Summary] Generation failed:", err);
    return null;
  }
}
