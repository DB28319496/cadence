import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireAutomations } from "@/lib/automation-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    include: {
      workspace: {
        select: { id: true, name: true, emailFromName: true, emailReplyTo: true, portalEnabled: true },
      },
      currentStage: { select: { id: true, name: true } },
    },
  });

  let fired = 0;

  for (const client of clients) {
    if (!client.stageEnteredAt || !client.currentStageId || !client.currentStage) continue;

    const daysInStage = Math.floor(
      (Date.now() - new Date(client.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Lifetime dedup is handled inside fireAutomations — no duplicate check needed here
    await fireAutomations(
      { type: "TIME_IN_STAGE", stageId: client.currentStageId, daysInStage },
      { ...client, portalToken: client.portalToken ?? null, stageEnteredAt: client.stageEnteredAt },
      client.workspace,
      client.currentStage.name
    ).catch(console.error);

    fired++;
  }

  console.log(`[cron] checked ${clients.length} clients, triggered automations for ${fired}`);
  return NextResponse.json({ ok: true, clients: clients.length, fired });
}
