// Operator email notifications for run transitions: a run that newly blocks
// (needs the operator) or goes live. Fire-and-forget — never block or fail the
// engine on a mail error. No-ops cleanly when no recipients / no RESEND key.

import { sendEmail } from "@/lib/email";
import { getStepDef } from "@/lib/setup/pipeline";
import { notifyRecipients } from "@/lib/setup/operator";

type Kind = "blocked" | "failed" | "live";

const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002").replace(/\/$/, "");

export async function notifyOperator(
  kind: Kind,
  opts: { runId: string; businessName: string; step: string | null }
): Promise<void> {
  try {
    const to = notifyRecipients();
    if (to.length === 0) return;

    const link = `${appUrl()}/setup/${opts.runId}`;
    const stepLabel = opts.step ? getStepDef(opts.step)?.label ?? opts.step : null;

    const { subject, lead } =
      kind === "live"
        ? { subject: `✅ ${opts.businessName} is live`, lead: "The onboarding run completed and the agent is live (48-hour watch on)." }
        : kind === "failed"
          ? { subject: `❌ ${opts.businessName} — step failed`, lead: `A step failed${stepLabel ? ` at “${stepLabel}”` : ""} and needs attention.` }
          : { subject: `⏸ ${opts.businessName} needs you${stepLabel ? ` — ${stepLabel}` : ""}`, lead: `The run is blocked${stepLabel ? ` at “${stepLabel}”` : ""} and is waiting on the operator.` };

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <p>${lead}</p>
        <p><strong>${opts.businessName}</strong></p>
        <p><a href="${link}">Open the run →</a></p>
      </div>`;

    await sendEmail({ to: to.join(","), subject, html, fromName: "Switchboard Setup" });
  } catch (err) {
    console.error("[Switchboard] operator notification failed:", err);
  }
}
