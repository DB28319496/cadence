/**
 * Apply ONLY the Switchboard setup-engine tables to the prod Turso DB.
 * Idempotent (CREATE TABLE / INDEX IF NOT EXISTS). Reads creds from env — never
 * prints the auth token. Refuses to run against a local file: DB.
 *
 * Run: DATABASE_URL=... DATABASE_AUTH_TOKEN=... pnpm exec tsx scripts/apply-turso-switchboard.ts
 */
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  console.error(`Refusing: DATABASE_URL is not a remote Turso URL (starts with "${url.slice(0, 8)}…").`);
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS "SwitchboardClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "config" JSONB,
    "systemPrompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "OnboardingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStep" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "OnboardingRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "SwitchboardClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ProvisioningStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProvisioningStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "OnboardingRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingRun_clientId_key" ON "OnboardingRun"("clientId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ProvisioningStep_runId_key_key" ON "ProvisioningStep"("runId", "key")`,
];

async function main() {
  const client = createClient({ url: url!, authToken });
  console.log(`Connecting to Turso (${url!.replace(/\/\/([^.]+).*/, "//$1…")})`);
  for (const s of statements) {
    await client.execute(s);
    console.log(`  ✓ ${s.split("\n")[0].slice(0, 60)}…`);
  }
  const res = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SwitchboardClient','OnboardingRun','ProvisioningStep') ORDER BY name`
  );
  console.log("Tables now present:", res.rows.map((r) => r.name).join(", "));
  client.close();
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
