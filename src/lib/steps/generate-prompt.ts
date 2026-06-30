import { prisma } from "@/lib/prisma";
import { generatePrompt } from "@/lib/integrations/llm";
import { switchboardConfigSchema } from "@/lib/setup/config-schema";
import type { StepHandler } from "./types";

export const generatePromptHandler: StepHandler = async ({ client }) => {
  const parsed = switchboardConfigSchema.safeParse(client.config);
  if (!parsed.success) {
    return {
      status: "failed",
      result: { error: "No valid config on client. Re-run generate_config first." },
    };
  }

  const prompt = await generatePrompt(parsed.data);

  await prisma.switchboardClient.update({
    where: { id: client.id },
    data: { systemPrompt: prompt },
  });

  return {
    status: "done",
    result: { length: prompt.length, preview: prompt.slice(0, 280) },
  };
};
