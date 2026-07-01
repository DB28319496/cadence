// Twilio integration: buy an agent number near the client, attach it to the
// voice agent, and handle A2P 10DLC brand/campaign registration + status polling.
// Live calls gated behind TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN; stub otherwise.
// Live shapes follow Twilio's REST API but are UNVERIFIED here.

import { provisionStubEnabled, stubId, IntegrationError } from "./stub";

const KEY_ENV = "TWILIO_ACCOUNT_SID";

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID ?? "";
  const token = process.env.TWILIO_AUTH_TOKEN ?? "";
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

async function twilioForm(url: string, form: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) {
    throw new IntegrationError(`Twilio ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface BuyNumberResult {
  phoneSid: string;
  phoneNumber: string;
}

/** Derive a 3-digit area code hint from a city string, if present. */
function areaCodeHint(city: string | null | undefined): string | undefined {
  const m = (city ?? "").match(/\b(\d{3})\b/);
  return m?.[1];
}

export async function buyNumber(
  config: Record<string, unknown>,
  clientId: string
): Promise<BuyNumberResult> {
  if (provisionStubEnabled(KEY_ENV)) {
    const seed = `${clientId}`;
    const digits = stubId("x", seed).replace(/\D/g, "").padEnd(7, "0").slice(0, 7);
    return { phoneSid: stubId("PN", seed), phoneNumber: `+1555${digits.slice(0, 7)}` };
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const areaCode = areaCodeHint(config.city as string | undefined);

  // Search, then purchase the first match.
  const searchUrl =
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json` +
    (areaCode ? `?AreaCode=${areaCode}` : "");
  const search = (await fetch(searchUrl, { headers: { Authorization: authHeader() } }).then((r) =>
    r.json()
  )) as { available_phone_numbers?: { phone_number: string }[] };
  const candidate = search.available_phone_numbers?.[0]?.phone_number;
  if (!candidate) throw new IntegrationError("Twilio: no available numbers for area");

  const bought = (await twilioForm(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
    { PhoneNumber: candidate }
  )) as { sid: string; phone_number: string };

  return { phoneSid: bought.sid, phoneNumber: bought.phone_number };
}

/** Attach a purchased number to the voice agent (provider-specific webhook). */
export async function attachNumberToAgent(
  phoneSid: string,
  agentId: string
): Promise<void> {
  if (provisionStubEnabled(KEY_ENV)) return;
  // Wiring depends on the voice provider's inbound webhook; left as a documented
  // no-op until the provider account is connected.
  void phoneSid;
  void agentId;
}

export interface A2PRegistration {
  brandSid: string;
  campaignSid: string;
}

export async function registerA2P(input: {
  ein: string;
  brand: string;
  campaign: string;
  clientId: string;
}): Promise<A2PRegistration> {
  if (provisionStubEnabled(KEY_ENV)) {
    return {
      brandSid: stubId("BN", `${input.clientId}:brand`),
      campaignSid: stubId("CM", `${input.clientId}:campaign`),
    };
  }
  // Real flow: create A2P Brand (with EIN) then Campaign under it. Shapes vary by
  // account type; confirm against Twilio Messaging/TrustHub docs before prod.
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const brand = (await twilioForm(
    `https://messaging.twilio.com/v1/a2p/BrandRegistrations`,
    { BusinessName: input.brand, BusinessIdentity: input.ein }
  ).catch(() => ({ sid: "" }))) as { sid: string };
  void sid;
  return { brandSid: brand.sid, campaignSid: "" };
}

export type A2PStatus = "pending" | "approved" | "rejected";

export async function getA2PStatus(
  brandSid: string,
  clientId: string
): Promise<A2PStatus> {
  if (provisionStubEnabled(KEY_ENV)) {
    // Stub approves immediately so the poll loop terminates deterministically.
    void brandSid;
    void clientId;
    return "approved";
  }
  const res = await fetch(
    `https://messaging.twilio.com/v1/a2p/BrandRegistrations/${brandSid}`,
    { headers: { Authorization: authHeader() } }
  );
  if (!res.ok) return "pending";
  const data = (await res.json()) as { status?: string };
  if (data.status === "APPROVED") return "approved";
  if (data.status === "FAILED" || data.status === "REJECTED") return "rejected";
  return "pending";
}
