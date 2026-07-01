import type {
  OnboardingRun,
  ProvisioningStep,
  SwitchboardClient,
} from "@prisma/client";

/** Everything a step handler needs. `client` is reloaded fresh before each step
 *  so a handler sees config/prompt written by an earlier step in the same run. */
export interface StepContext {
  run: OnboardingRun;
  step: ProvisioningStep;
  client: SwitchboardClient;
  steps: ProvisioningStep[];
}

/** A handler never persists its own status — it returns an outcome and the
 *  engine writes step.status + step.result and decides whether to advance. */
export type StepOutcome =
  | { status: "done"; result: unknown }
  | { status: "blocked"; result: unknown }
  | { status: "failed"; result: unknown };

export type StepHandler = (ctx: StepContext) => Promise<StepOutcome>;
