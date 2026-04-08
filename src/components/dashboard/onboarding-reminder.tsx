import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

export function OnboardingReminder() {
  return (
    <div className="mx-6 mt-4 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              Let AI build your workspace
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Answer 6 quick questions and we&apos;ll create a custom pipeline, email templates, and automations tailored to your business.
            </p>
          </div>
        </div>
        <Link
          href="/onboarding"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get started
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
