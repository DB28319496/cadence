"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

export default function DemoPage() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loginAsDemo() {
      const result = await signIn("credentials", {
        email: "alex@prestigerealty.com",
        password: "password123",
        redirect: false,
      });

      if (cancelled) return;

      if (result?.error) {
        setError(true);
      } else {
        router.push("/dashboard?tour=1");
        router.refresh();
      }
    }

    loginAsDemo();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Cadence</span>
        </div>
        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive font-medium">
              Demo account unavailable
            </p>
            <p className="text-xs text-muted-foreground">
              Please try again later or sign in manually.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">
              Loading demo environment...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
