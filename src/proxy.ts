import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/intake|api/portal|api/widget|api/cron|api/email-tracking|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
