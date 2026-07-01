import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOperator } from "@/lib/setup/operator";
import { createRunFromIntake } from "@/lib/setup/service";
import { VERTICALS } from "@/lib/setup/config-schema";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("paste"), text: z.string().min(1, "Paste some intake first") }),
  z.object({
    mode: z.literal("form"),
    form: z.object({
      businessName: z.string().min(1, "Business name is required"),
      vertical: z.enum(VERTICALS),
      city: z.string().optional(),
      hours: z.string().optional(),
      services: z.string().optional(),
      phone: z.string().optional(),
      ownerPhone: z.string().optional(),
    }),
  }),
]);

// Create a SwitchboardClient + OnboardingRun (12 seeded steps), then run the
// engine to the first blocker. Operator-gated via middleware + requireOperator.
export async function POST(req: NextRequest) {
  const { error } = await requireOperator();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const { runId } = await createRunFromIntake(parsed.data);
    return NextResponse.json({ runId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create run" },
      { status: 500 }
    );
  }
}
