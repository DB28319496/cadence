// Operator access gate for the Switchboard console. The whole /setup surface is
// already behind Cadence's auth middleware (login required); this narrows it to
// a configured operator allowlist when SWITCHBOARD_OPERATOR_EMAILS is set. When
// it's unset, any logged-in user is treated as the operator (single-tenant dev).

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";

export function operatorEmails(): string[] {
  return (process.env.SWITCHBOARD_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isOperatorEmail(email?: string | null): boolean {
  const allow = operatorEmails();
  if (allow.length === 0) return true; // no allowlist -> any authenticated user
  return !!email && allow.includes(email.toLowerCase());
}

/** Recipients for operator notifications (allowlist, else OPERATOR_EMAIL). */
export function notifyRecipients(): string[] {
  const allow = operatorEmails();
  if (allow.length > 0) return allow;
  const fallback = process.env.OPERATOR_EMAIL?.trim();
  return fallback ? [fallback] : [];
}

/** API-route guard: 401 if not authed, 403 if not an allowed operator. */
export async function requireOperator() {
  const { session, userId, error } = await requireAuth();
  if (error) return { error };
  const email = session?.user?.email ?? null;
  if (!isOperatorEmail(email)) {
    return {
      error: NextResponse.json({ error: "Operator access required" }, { status: 403 }),
    };
  }
  return { userId, email, error: null as null };
}
