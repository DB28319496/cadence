import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/setup/operator";
import { markStepDone } from "@/lib/setup/service";
import { STEP_KEYS, type StepKey } from "@/lib/setup/pipeline";

// Operator marks a manual task (forwarding / a2p / trust_check) done -> resume.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string; key: string }> }
) {
  const { error } = await requireOperator();
  if (error) return error;

  const { runId, key } = await params;
  if (!STEP_KEYS.includes(key as StepKey)) {
    return NextResponse.json({ error: "Unknown step key" }, { status: 400 });
  }

  try {
    const run = await markStepDone(runId, key as StepKey);
    return NextResponse.json({ status: run.status, currentStep: run.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to mark done" },
      { status: 400 }
    );
  }
}
