import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireWeeklySummary } from "@/lib/automation-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only run on Mondays (day 1); Netlify schedule handles timing but add guard for safety
  const day = new Date().getDay();
  if (day !== 1) {
    return NextResponse.json({ ok: true, skipped: "not Monday" });
  }

  // Find all workspaces with an active WEEKLY_SUMMARY rule
  const workspaces = await prisma.workspace.findMany({
    where: {
      automationRules: {
        some: { triggerType: "WEEKLY_SUMMARY", isActive: true },
      },
    },
    select: { id: true },
  });

  let fired = 0;
  for (const ws of workspaces) {
    await fireWeeklySummary(ws.id).catch(console.error);
    fired++;
  }

  console.log(`[cron/weekly-summary] processed ${fired} workspaces`);
  return NextResponse.json({ ok: true, workspaces: workspaces.length, fired });
}
