import { prisma } from "@/lib/prisma";
import { generateConfig } from "@/lib/integrations/llm";
import type { SwitchboardConfig } from "@/lib/setup/config-schema";
import type { StepHandler } from "./types";

/** intake.result shape (written by the run seeder). */
interface IntakeResult {
  intakeText?: string;
}

export const generateConfigHandler: StepHandler = async ({ client, steps }) => {
  const intake = steps.find((s) => s.key === "intake");
  const intakeText = (intake?.result as IntakeResult | null)?.intakeText?.trim();
  if (!intakeText) {
    return { status: "failed", result: { error: "No intake text found on the run." } };
  }

  const { config, missing } = await generateConfig(intakeText);
  config.client_id = client.id; // stamp the real id onto the config

  if (missing.length > 0) {
    return {
      status: "blocked",
      result: {
        note: "Intake is missing required fields. Edit the intake and re-run.",
        missing,
        config,
      },
    };
  }

  // Persist config + sync the client's display fields from it.
  await prisma.switchboardClient.update({
    where: { id: client.id },
    data: {
      config: config as object,
      businessName: config.business_name,
      vertical: config.vertical,
    },
  });

  return { status: "done", result: { config } satisfies { config: SwitchboardConfig } };
};
