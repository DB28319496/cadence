import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isOperatorEmail } from "@/lib/setup/operator";
import { Button } from "@/components/ui/button";
import { Radio, Plus } from "lucide-react";

// Operator console for the Switchboard setup engine. Auth is enforced by the
// middleware (these routes aren't public); here we additionally narrow access to
// the operator allowlist (SWITCHBOARD_OPERATOR_EMAILS) when one is configured.
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isOperatorEmail(session.user.email)) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/setup" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary">
              <Radio className="size-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">Switchboard Setup</span>
          </Link>
          <Button asChild size="sm">
            <Link href="/setup/new">
              <Plus className="size-4" />
              New run
            </Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
