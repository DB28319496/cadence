# Cadence

Multi-tenant B2B SaaS for managing client onboarding end to end — from first contact through project completion.

**Status:** multi-phase build · `OnboardFlow` is its marketing front-end

---

## What it does

- **Client CRM** — accounts, contacts, and per-client state
- **Onboarding templates** — reusable playbooks applied per client
- **Pipeline management** — where every client sits in the onboarding flow
- **Client portal** — the customer's own view of their onboarding
- **Switchboard Setup Engine** — a 12-step provisioning state machine that uses LLM steps to generate configuration, then auto-provisions the client's stack:
  - a Retell/Vapi voice agent
  - Cal.com event types
  - a Twilio phone number
  - n8n workflow registration

## Why it exists

Onboarding a service business onto a voice-agent product involves a dozen manual configuration steps across four vendors. Getting that wrong is how onboarding stalls. The setup engine turns it into one guided flow with an auditable step-by-step state machine, so a stalled client shows exactly which step failed and why.

## Stack

Next.js · TypeScript · Prisma + libSQL/Turso · Auth.js · Anthropic SDK · Twilio · Cal.com · n8n · Retell · Docker

## Architecture notes

- **Multi-tenant** — every query is scoped per tenant; no cross-client data paths
- **Provisioning as a state machine** — each of the 12 steps records its own status, so a run can be inspected and resumed rather than restarted blind
- **LLM steps are bounded** — the model generates configuration values inside a fixed schema; it does not drive control flow
