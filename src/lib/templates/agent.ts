// Registry for the vertical agent system-prompt templates + their standard
// booking_fields / hot_job_rules defaults. Kept separate from ./index.ts, which
// is the (unrelated) workspace-blueprint library for Cadence onboarding.

import type { Vertical } from "@/lib/setup/config-schema";
import { AUTO_TEMPLATE, AUTO_DEFAULTS } from "./auto";
import { HVAC_TEMPLATE, HVAC_DEFAULTS } from "./hvac";
import { HOME_SERVICES_TEMPLATE, HOME_SERVICES_DEFAULTS } from "./home_services";

export interface VerticalDefaults {
  booking_fields: string[];
  hot_job_rules: string[];
}

const TEMPLATES: Record<Vertical, string> = {
  auto: AUTO_TEMPLATE,
  hvac: HVAC_TEMPLATE,
  home_services: HOME_SERVICES_TEMPLATE,
};

const DEFAULTS: Record<Vertical, VerticalDefaults> = {
  auto: AUTO_DEFAULTS,
  hvac: HVAC_DEFAULTS,
  home_services: HOME_SERVICES_DEFAULTS,
};

export function getAgentTemplate(vertical: Vertical): string {
  return TEMPLATES[vertical];
}

export function getVerticalDefaults(vertical: Vertical): VerticalDefaults {
  return DEFAULTS[vertical];
}
