import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DemoPage() {
  // If already logged in as demo user, go straight to the tour
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard?tour=1");
  }

  // Auto-sign in as the demo account
  await signIn("credentials", {
    email: "alex@prestigerealty.com",
    password: "password123",
    redirectTo: "/dashboard?tour=1",
  });
}
