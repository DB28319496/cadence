import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Shared status chips for steps and runs. Server-component safe (no client JS).

type Variant = "default" | "secondary" | "destructive" | "outline";

const STEP: Record<string, { variant: Variant; className?: string; label?: string }> = {
  pending: { variant: "outline" },
  running: { variant: "secondary", className: "animate-pulse" },
  done: { variant: "default" },
  blocked: { variant: "outline", className: "border-amber-400 bg-amber-50 text-amber-800" },
  failed: { variant: "destructive" },
  skipped: { variant: "outline", className: "text-muted-foreground" },
};

export function StepStatusChip({ status }: { status: string }) {
  const s = STEP[status] ?? { variant: "outline" as Variant };
  return (
    <Badge variant={s.variant} className={cn("capitalize", s.className)}>
      {s.label ?? status}
    </Badge>
  );
}

const RUN: Record<string, { variant: Variant; className?: string }> = {
  draft: { variant: "outline" },
  running: { variant: "secondary", className: "animate-pulse" },
  blocked: { variant: "outline", className: "border-amber-400 bg-amber-50 text-amber-800" },
  live: { variant: "default", className: "bg-emerald-600 text-white" },
  failed: { variant: "destructive" },
};

export function RunStatusBadge({ status }: { status: string }) {
  const s = RUN[status] ?? { variant: "outline" as Variant };
  return (
    <Badge variant={s.variant} className={cn("capitalize", s.className)}>
      {status}
    </Badge>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
