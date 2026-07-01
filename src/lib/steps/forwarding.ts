import { readConfig } from "@/lib/setup/config-store";
import type { StepHandler } from "./types";

// Manual task: client sets no-answer / after-hours forwarding to the agent number.
// Manual handlers always return `blocked` with the task content; the engine
// presents it and waits for the operator to mark it done.
export const forwardingHandler: StepHandler = async ({ client }) => {
  const config = readConfig(client.config);
  const agentNumber = (config.agent_number as string) ?? "(agent number pending)";

  return {
    status: "blocked",
    result: {
      label: "Call forwarding",
      task: "Have the client set no-answer and after-hours call forwarding on their carrier to the agent number.",
      agentNumber,
      instructions: [
        `Forward unanswered/after-hours calls to ${agentNumber}.`,
        "Conditional (no-answer) forwarding is usually *61* + number + #.",
        "Busy forwarding is usually *67* + number + #.",
        "Carrier codes vary (Verizon/AT&T/T-Mobile) — confirm the client's carrier.",
      ],
    },
  };
};
