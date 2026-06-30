import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/setup/operator";
import { submitA2P } from "@/lib/setup/service";

const schema = z.object({
  ein: z.string().min(1, "EIN is required"),
  brand: z.string().optional(),
  campaign: z.string().optional(),
});

// Operator submits the A2P brand + campaign (with the client's EIN). Kicks off
// approval polling; the step stays blocked until Twilio approves.
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
    const run = await submitA2P(runId, parsed.data);
    return NextResponse.json({ status: run?.status, currentStep: run?.currentStep });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "A2P submission failed" },
      { status: 400 }
    );
  }
}
