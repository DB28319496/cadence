"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Layers,
  MessageSquareText,
  FileText,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import type { BlueprintSummary } from "@/lib/templates";
import { QuestionnaireForm } from "./questionnaire-form";
import { TemplateGallery } from "./template-gallery";
import { PasteDocForm } from "./paste-doc-form";

type Mode = "choose" | "template" | "questions" | "paste";

type OnRamp = {
  mode: Exclude<Mode, "choose">;
  icon: typeof Layers;
  title: string;
  description: string;
  requiresAi: boolean;
};

const ON_RAMPS: OnRamp[] = [
  {
    mode: "template",
    icon: Layers,
    title: "Start from a template",
    description: "Pick a ready-made workspace for your industry and go live instantly.",
    requiresAi: false,
  },
  {
    mode: "questions",
    icon: MessageSquareText,
    title: "Answer 6 questions",
    description: "Tell us about your business and AI builds a workspace around it.",
    requiresAi: true,
  },
  {
    mode: "paste",
    icon: FileText,
    title: "Paste a document",
    description: "Drop in a description, SOP, or process doc — we'll turn it into a workspace.",
    requiresAi: true,
  },
];

export function OnboardingChooser({
  blueprints,
  aiAvailable,
}: {
  blueprints: BlueprintSummary[];
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [skipping, setSkipping] = useState(false);

  const skip = async () => {
    setSkipping(true);
    try {
      await fetch("/api/onboarding/skip", { method: "POST" });
      router.push("/dashboard");
      router.refresh();
    } catch {
      router.push("/dashboard");
    }
  };

  // ── Questionnaire mode renders the existing self-contained form ───────────
  if (mode === "questions") {
    return (
      <div className="w-full max-w-2xl">
        <BackLink onClick={() => setMode("choose")} />
        <QuestionnaireForm />
      </div>
    );
  }

  if (mode === "template" || mode === "paste") {
    return (
      <div className="w-full max-w-2xl">
        <BackLink onClick={() => setMode("choose")} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "template" ? "Pick a template" : "Paste your document"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            {mode === "template"
              ? "Choose a curated workspace — pipeline, emails, and automations included."
              : "We'll read it and build a tailored workspace. Nothing is shared externally."}
          </p>
        </div>
        {mode === "template" ? (
          <TemplateGallery blueprints={blueprints} />
        ) : (
          <PasteDocForm />
        )}
      </div>
    );
  }

  // ── Choose screen ─────────────────────────────────────────────────────────
  const ramps = ON_RAMPS.filter((r) => aiAvailable || !r.requiresAi);

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          Workspace Setup
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          How would you like to start?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          {aiAvailable
            ? "Pick a template, answer a few questions, or paste a doc — all three build a complete workspace."
            : "Choose a ready-made template to get your workspace set up in one click."}
        </p>
      </div>

      <div className="space-y-3">
        {ramps.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.mode}
              type="button"
              onClick={() => setMode(r.mode)}
              className="group w-full text-left rounded-2xl border-2 border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-muted/30"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-sm tracking-tight">{r.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={skip}
          disabled={skipping}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {skipping ? "Skipping..." : "Skip for now — I'll set up manually"}
        </button>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to setup options
    </button>
  );
}
