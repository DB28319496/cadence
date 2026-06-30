import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/setup/operator";
import { updateConfigAndRerun } from "@/lib/setup/service";

const schema = z.object({ config: z.unknown() });

// Operator edits the generated config -> re-run the brain (prompt + QA).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { error } = await requireOperator();
  if (error) return error;

  const { runId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { config }" }, { status: 400 });
  }

  try {
    const run = await updateConfigAndRerun(runId, parsed.data.config);
    return NextResponse.json({ status: run.status, currentStep: run.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Config update failed" },
      { status: 400 }
    );
  }
}
