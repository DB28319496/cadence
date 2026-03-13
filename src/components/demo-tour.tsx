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
  position: "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Cadence",
    description:
      "This is a live demo of Cadence — a client onboarding platform built for service businesses. You're viewing a real estate agency's account with active clients, pipelines, and automations. Let's take a quick tour.",
    icon: Sparkles,
    position: "center",
  },
  {
    title: "Pipeline Dashboard",
    description:
      "This is your command center. Every client is a card on the Kanban board, organized by their current stage. Drag cards between stages as clients progress. The stats at the top show active clients, pipeline value, and averages at a glance.",
    icon: LayoutDashboard,
    href: "/dashboard",
    position: "top-left",
  },
  {
    title: "Client Management",
    description:
      "View all clients in one place with powerful filters. Click any client to see their full profile — contact info, project details, activity timeline, checklist progress, and documents. Everything your team needs in one view.",
    icon: Users,
    href: "/clients",
    position: "top-left",
  },
  {
    title: "Custom Pipelines",
    description:
      "Design your onboarding workflow with custom stages. Each stage has its own checklist, expected timeline, and color coding. Build multiple pipelines for different service types — buyer journeys, seller listings, or rental onboarding.",
    icon: Workflow,
    href: "/pipelines",
    position: "top-left",
  },
  {
    title: "Email Templates",
    description:
      "Create branded email templates with merge fields like {{client_name}} and {{portal_link}}. Templates automatically personalize for each client. Use them manually or connect them to automations for hands-free communication.",
    icon: Mail,
    href: "/email-templates",
    position: "top-left",
  },
  {
    title: "Automations",
    description:
      "Set up trigger-based rules that fire automatically. Send a welcome email when a client is created, follow up when they've been in a stage too long, or notify your team of important milestones. No code required.",
    icon: Zap,
    href: "/automations",
    position: "top-left",
  },
  {
    title: "Analytics & Reporting",
    description:
      "Track your pipeline health with real-time analytics. See conversion rates, identify bottlenecks, monitor overdue clients, and measure your team's performance — all from one dashboard.",
    icon: BarChart3,
    href: "/analytics",
    position: "top-left",
  },
  {
    title: "You're all set!",
    description:
      "That's the core of Cadence. Feel free to explore — click around, open client profiles, check out the Kanban board. Everything here is fully interactive. When you're ready, head back to the dashboard and start exploring.",
    icon: Sparkles,
    position: "center",
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
    // Remove tour param from URL
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

  // Keyboard navigation
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      {/* Tour card */}
      <div className="relative mx-4 w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
          {/* Header accent */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />

          <div className="p-6 sm:p-8">
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mb-5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-6 bg-primary"
                      : i < step
                        ? "w-3 bg-primary/40"
                        : "w-3 bg-muted"
                  }`}
                />
              ))}
            </div>

            {/* Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
              <Icon className="h-6 w-6 text-primary" />
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold tracking-tight mb-2">
              {currentStep.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {currentStep.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {step + 1} of {TOUR_STEPS.length}
              </div>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={prev}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {isLast ? "Start Exploring" : "Next"}
                  {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Keyboard hint */}
            <p className="text-[11px] text-muted-foreground/50 mt-3 text-center hidden sm:block">
              Use arrow keys to navigate · Esc to close
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
