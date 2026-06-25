import { NextRequest, NextResponse } from "next/server";

// All Auth.js cookie variants across environments: non-prefixed (local http) +
// __Secure-/__Host- (production https), plus chunked session-token names.
const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.session-token.0",
  "__Secure-authjs.session-token.0",
  "authjs.session-token.1",
  "__Secure-authjs.session-token.1",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

// Sign-out via a full-page GET navigation (not a fetch/server-action). Browsers
// reliably apply Set-Cookie on a navigation response, so the session cookie is
// actually cleared before the redirect to /login — unlike the fetch-based
// next-auth/react signOut, whose Set-Cookie raced the client-side navigation
// and left users logged in on the serverless deploy.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const res = NextResponse.redirect(`${proto}://${host}/login`, { status: 303 });

  for (const name of AUTH_COOKIE_NAMES) {
    res.cookies.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__"),
    });
  }
  return res;
}
