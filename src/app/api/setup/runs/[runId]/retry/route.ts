import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/setup/operator";
import { retryStep } from "@/lib/setup/service";
import { STEP_KEYS, type StepKey } from "@/lib/setup/pipeline";

const schema = z.object({
  key: z.string().refine((k) => STEP_KEYS.includes(k as StepKey), "Unknown step key"),
});

// Reset one step to pending and drive the run again (Run / Retry).
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
    const run = await retryStep(runId, parsed.data.key as StepKey);
    return NextResponse.json({ status: run.status, currentStep: run.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Retry failed" },
      { status: 500 }
    );
  }
}
