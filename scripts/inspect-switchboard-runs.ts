/** Read-only: show recent Switchboard runs + step statuses (prod diagnostic). */
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url || (!url.startsWith("libsql://") && !url.startsWith("https://"))) {
  console.error("Need a remote DATABASE_URL"); process.exit(1);
}

async function main() {
  const c = createClient({ url: url!, authToken });
  const runs = await c.execute(
    `SELECT r.id, r.status, r.currentStep, r.startedAt, cl.businessName
     FROM OnboardingRun r JOIN SwitchboardClient cl ON cl.id = r.clientId
     ORDER BY cl.createdAt DESC LIMIT 5`
  );
  for (const r of runs.rows) {
    console.log(`\n● ${r.businessName} — run=${String(r.id).slice(0,8)} status=${r.status} current=${r.currentStep}`);
    const steps = await c.execute({
      sql: `SELECT key, status, attempts FROM ProvisioningStep WHERE runId = ? ORDER BY rowid`,
      args: [r.id],
    });
    for (const s of steps.rows) console.log(`    ${String(s.key).padEnd(18)} ${s.status}  (x${s.attempts})`);
  }
  c.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
