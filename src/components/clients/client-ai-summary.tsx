"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ClientAiSummary({ clientId }: { clientId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/ai-summary`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed");
      }
      const data = await res.json() as { summary: string };
      setSummary(data.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI summary failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-violet-700">AI Status Summary</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-100",
            loading && "opacity-50"
          )}
          onClick={generate}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : summary ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            "Generate"
          )}
        </Button>
      </div>

      {summary ? (
        <p className="text-xs text-violet-900 leading-relaxed">{summary}</p>
      ) : (
        <p className="text-xs text-violet-400 italic">
          Click Generate to get an AI-powered status summary.
        </p>
      )}
    </div>
  );
}
