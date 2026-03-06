import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fireAutomations } from "@/lib/automation-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", stageEnteredAt: { not: null } },
    include: {
      workspace: {
        select: { id: true, name: true, emailFromName: true, emailReplyTo: true },
      },
      currentStage: { select: { id: true, name: true } },
    },
  });

  let checked = 0;
  let fired = 0;

  for (const client of clients) {
    if (!client.stageEnteredAt || !client.currentStageId || !client.currentStage) continue;

    const daysInStage = Math.floor(
      (Date.now() - new Date(client.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Only fire if exactly on the day (prevents duplicate fires if cron runs multiple times)
    const alreadySentToday = await prisma.emailLog.findFirst({
      where: {
        clientId: client.id,
        sentAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
        automationRule: {
          triggerType: "TIME_IN_STAGE",
          triggerConfig: { contains: client.currentStageId },
        },
      },
    });
    if (alreadySentToday) continue;

    await fireAutomations(
      { type: "TIME_IN_STAGE", stageId: client.currentStageId, daysInStage },
      client,
      client.workspace,
      client.currentStage.name
    ).catch(console.error);

    checked++;
    fired++;
  }

  console.log(`[cron] checked ${clients.length} clients, triggered automations for ${fired}`);
  return NextResponse.json({ ok: true, clients: clients.length, checked, fired });
}
