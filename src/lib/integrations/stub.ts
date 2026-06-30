// Shared helpers for the provisioning integrations. Each integration runs in
// "stub" mode when its API key is missing OR when SWITCHBOARD_PROVISION_STUB is
// forced on. Stub mode returns deterministic fake IDs so the whole pipeline runs
// to go_live offline with zero third-party keys, and so retries are idempotent
// (same seed -> same id, never a duplicate create).

export function provisionStubEnabled(apiKeyEnv: string): boolean {
  if (process.env.SWITCHBOARD_PROVISION_STUB === "true") return true;
  return !process.env[apiKeyEnv];
}

/** Deterministic id from a seed (no Math.random — stable across retries). */
export function stubId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  return `${prefix}_stub_${hex}`;
}

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationError";
  }
}
