import type { StepHandler } from "./types";

// Manual (async) task: register the A2P 10DLC brand + campaign (needs the
// client's EIN), then poll Twilio for approval and auto-advance. This handler
// only builds the task content on first arrival; the EIN submission + poll
// enqueue happen via /api/setup/runs/[runId]/a2p (see service.submitA2P).
export const a2pHandler: StepHandler = async ({ step }) => {
  // If the EIN was already submitted, keep the submitted state (don't reset).
  const prior = step.result as { brandSid?: string } | null;
  if (prior?.brandSid) {
    return {
      status: "blocked",
      result: { ...prior, note: "A2P submitted — polling Twilio for approval." },
    };
  }

  return {
    status: "blocked",
    result: {
      label: "A2P 10DLC",
      task: "Collect the client's EIN, then submit the A2P brand + campaign. Approval is polled automatically and the run advances on approval.",
      needsEin: true,
      checklist: [
        "Get the client's EIN and legal business name.",
        "Submit via the A2P form on this run.",
        "Twilio reviews the brand/campaign; the poll advances the step when approved.",
      ],
    },
  };
};
