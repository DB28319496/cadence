import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/setup/operator";
import { updateIntakeAndRerun } from "@/lib/setup/service";

const schema = z.object({ intakeText: z.string().min(1, "Intake text cannot be empty") });

// Edit the intake text, reset the brain steps, and re-run from generate_config.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { error } = await requireOperator();
  if (error) return error;

  const { runId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const run = await updateIntakeAndRerun(runId, parsed.data.intakeText);
    return NextResponse.json({ status: run.status, currentStep: run.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}
