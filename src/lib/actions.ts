"use server";

import { signOut } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// All Auth.js cookie variants we may have set, across environments:
// non-prefixed (local http) + __Secure-/__Host- (production https), plus the
// chunked session-token names used when the JWT is large.
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

export async function signOutAction() {
  // Let Auth.js clear its session first.
  try {
    await signOut({ redirect: false });
  } catch {
    // ignore — we force-clear below regardless
  }

  // Belt-and-suspenders: explicitly expire every cookie variant with matching
  // attributes. On some serverless/proxy setups Auth.js's own deletion doesn't
  // match the __Secure-/__Host- prefixed names, leaving the user signed in.
  const store = await cookies();
  for (const name of AUTH_COOKIE_NAMES) {
    store.set(name, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__"),
    });
  }

  redirect("/login");
}
