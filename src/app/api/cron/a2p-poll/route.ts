import { NextRequest, NextResponse } from "next/server";
import { pollA2P } from "@/lib/setup/service";

// A2P approval poll, driven by QStash (delayed self-rescheduling messages) or a
// manual curl. Lives under /api/cron so it inherits the public + CRON_SECRET
// convention (middleware doesn't gate /api/cron). Accepts the secret via the
// Authorization header or the JSON body (QStash forwards the body).
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { runId?: string; secret?: string };

  const authHeader = req.headers.get("authorization");
  const secretOk =
    !!process.env.CRON_SECRET &&
    (authHeader === `Bearer ${process.env.CRON_SECRET}` || body.secret === process.env.CRON_SECRET);
  if (!secretOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!body.runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }

  try {
    const run = await pollA2P(body.runId);
    return NextResponse.json({ ok: true, status: run?.status, currentStep: run?.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Poll failed" },
      { status: 500 }
    );
  }
}
