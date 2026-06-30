import { qaReview } from "@/lib/integrations/llm";
import { switchboardConfigSchema } from "@/lib/setup/config-schema";
import type { StepHandler } from "./types";

export const qaReviewHandler: StepHandler = async ({ client }) => {
  const parsed = switchboardConfigSchema.safeParse(client.config);
  if (!parsed.success) {
    return {
      status: "failed",
      result: { error: "No valid config on client. Re-run generate_config first." },
    };
  }
  if (!client.systemPrompt) {
    return {
      status: "failed",
      result: { error: "No system prompt on client. Re-run generate_prompt first." },
    };
  }

  const review = await qaReview(client.systemPrompt, parsed.data);

  if (review.verdict === "no-go") {
    return {
      status: "blocked",
      result: {
        note: "QA returned no-go. Resolve the flags (edit intake/config) and re-run.",
        verdict: review.verdict,
        flags: review.flags,
      },
    };
  }

  return { status: "done", result: { verdict: review.verdict, flags: review.flags } };
};
