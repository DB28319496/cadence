import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export type MergeFields = {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  project_type?: string;
  project_value?: string;
  stage_name?: string;
  workspace_name?: string;
  company_name?: string;
  portal_url?: string;
  days_in_stage?: string;
};

export const MERGE_FIELD_TOKENS: { token: string; label: string }[] = [
  { token: "{{client_name}}", label: "Client Name" },
  { token: "{{client_email}}", label: "Client Email" },
  { token: "{{client_phone}}", label: "Client Phone" },
  { token: "{{project_type}}", label: "Project Type" },
  { token: "{{project_value}}", label: "Project Value" },
  { token: "{{stage_name}}", label: "Stage Name" },
  { token: "{{workspace_name}}", label: "Workspace Name" },
  { token: "{{company_name}}", label: "Company Name (alias)" },
  { token: "{{portal_url}}", label: "Client Portal URL" },
  { token: "{{days_in_stage}}", label: "Days in Current Stage" },
];

export function applyMergeFields(template: string, fields: MergeFields): string {
  let result = template;
  for (const [key, value] of Object.entries(fields)) {
    result = result.replaceAll(`{{${key}}}`, value ?? "");
  }
  return result;
}

export async function sendEmail({
  to,
  subject,
  html,
  fromName = "OnboardFlow",
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    // No API key configured — log and succeed silently (dev/demo mode)
    console.log(`[Email] No RESEND_API_KEY — skipping send to ${to}: ${subject}`);
    return { success: true };
  }
  try {
    await resend.emails.send({
      from: `${fromName} <onboarding@resend.dev>`,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { success: true };
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return { success: false, error: String(err) };
  }
}
