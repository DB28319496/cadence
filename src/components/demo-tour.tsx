"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  X,
  ArrowRight,
  ArrowLeft,
  LayoutDashboard,
  Users,
  Workflow,
  BarChart3,
  Mail,
  Zap,
  Sparkles,
} from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Cadence",
    description:
      "This is a live demo — a real estate agency's account with active clients, pipelines, and automations. Follow along as we walk through each feature.",
    icon: Sparkles,
  },
  {
    title: "Pipeline Dashboard",
    description:
      "Your command center. Clients are cards on the Kanban board, organized by stage. Drag to advance them. Stats at the top show pipeline health at a glance.",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    title: "Client Management",
    description:
      "All clients in one table with filters. Click any row to see their full profile — contact info, activity timeline, checklist progress, and documents.",
    icon: Users,
    href: "/clients",
  },
  {
    title: "Custom Pipelines",
    description:
      "Design workflows with custom stages, checklists, and timelines. Build separate pipelines for buyers, sellers, or rentals.",
    icon: Workflow,
    href: "/pipelines",
  },
  {
    title: "Email Templates",
    description:
      "Branded templates with merge fields like {{client_name}}. Use them manually or wire them to automations.",
    icon: Mail,
    href: "/email-templates",
  },
  {
    title: "Automations",
    description:
      "Trigger-based rules — send emails on stage changes, follow up after delays, or notify on milestones. No code required.",
    icon: Zap,
    href: "/automations",
  },
  {
    title: "Analytics",
    description:
      "Pipeline health at a glance — conversion rates, bottlenecks, overdue clients, and team performance.",
    icon: BarChart3,
    href: "/analytics",
  },
  {
    title: "You're all set!",
    description:
      "Feel free to explore — everything is fully interactive. Click around, open profiles, drag cards on the board.",
    icon: Sparkles,
  },
];

export function DemoTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("tour") === "1") {
      setIsVisible(true);
    }
  }, [searchParams]);

  const currentStep = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;

  const close = useCallback(() => {
    setIsVisible(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("tour");
    router.replace(url.pathname + url.search);
  }, [router]);

  const next = useCallback(() => {
    if (isLast) {
      close();
      router.push("/dashboard");
      return;
    }
    const nextStep = TOUR_STEPS[step + 1];
    setStep(step + 1);
    if (nextStep.href) {
      router.push(nextStep.href + "?tour=1");
    }
  }, [step, isLast, close, router]);

  const prev = useCallback(() => {
    if (isFirst) return;
    const prevStep = TOUR_STEPS[step - 1];
    setStep(step - 1);
    if (prevStep.href) {
      router.push(prevStep.href + "?tour=1");
    } else if (step - 1 === 0) {
      router.push("/dashboard?tour=1");
    }
  }, [step, isFirst, router]);

  useEffect(() => {
    if (!isVisible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isVisible, next, prev, close]);

  if (!isVisible) return null;

  const Icon = currentStep.icon;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[340px] sm:w-[380px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />

        <div className="p-4">
          {/* Top row: icon + title + close */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-bold tracking-tight truncate">
                {currentStep.title}
              </h3>
            </div>
            <button
              onClick={close}
              className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 pl-[42px]">
            {currentStep.description}
          </p>

          {/* Footer: progress + nav */}
          <div className="flex items-center justify-between pl-[42px]">
            {/* Step dots */}
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-4 bg-primary"
                      : i < step
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {isLast ? "Explore" : "Next"}
                {!isLast && <ArrowRight className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
