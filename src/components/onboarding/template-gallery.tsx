"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Layers, ArrowRight } from "lucide-react";
import type { BlueprintSummary } from "@/lib/templates";

export function TemplateGallery({ blueprints }: { blueprints: BlueprintSummary[] }) {
  const router = useRouter();
  const [selecting, setSelecting] = useState<string | null>(null);

  const choose = async (id: string) => {
    setSelecting(id);
    try {
      const res = await fetch("/api/onboarding/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Couldn't set up that template");
        setSelecting(null);
        return;
      }
      toast.success("Your workspace is ready!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSelecting(null);
    }
  };

  if (blueprints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No templates available yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {blueprints.map((b) => {
        const busy = selecting === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => choose(b.id)}
            disabled={!!selecting}
            className="group text-left rounded-2xl border-2 border-border bg-card p-5 transition-all hover:border-primary/50 hover:bg-muted/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                {busy ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Layers className="h-5 w-5 text-primary" />
                )}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {b.vertical}
              </span>
            </div>
            <h3 className="mt-3 font-bold text-sm tracking-tight">{b.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-3">
              {b.description}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{b.stageCount} stages</span>
              <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Use this <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
