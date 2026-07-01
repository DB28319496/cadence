import { NextRequest, NextResponse } from "next/server";
import { requireOperator } from "@/lib/setup/operator";
import { advanceRun } from "@/lib/engine";

// Advance a run by exactly one auto step, then return. The run page polls this
// while the run is "running" so each Claude call is its own request — keeps every
// invocation well under the serverless function timeout.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { error } = await requireOperator();
  if (error) return error;

  const { runId } = await params;
  try {
    const run = await advanceRun(runId, { maxSteps: 1 });
    return NextResponse.json({ status: run.status, currentStep: run.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Advance failed" },
      { status: 500 }
    );
  }
}
