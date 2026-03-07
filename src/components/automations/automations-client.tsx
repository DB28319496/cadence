"use client";

import { useState, useCallback } from "react";
import { Zap, Plus, Trash2, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AutomationDialog,
  type AutomationRow,
  type StageOption,
  type TemplateOption,
} from "./automation-dialog";

const TRIGGER_LABELS: Record<string, string> = {
  CLIENT_CREATED: "Client is created",
  STAGE_ENTRY: "Client enters",
  TIME_IN_STAGE: "Client in stage for",
  WEEKLY_SUMMARY: "Every Monday",
};

function triggerDescription(rule: AutomationRow): string {
  const base = TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType;
  if (rule.triggerType === "STAGE_ENTRY") {
    return `${base} "${rule.stage?.name ?? "unknown stage"}"`;
  }
  if (rule.triggerType === "TIME_IN_STAGE") {
    let days = "";
    try {
      const cfg = JSON.parse(rule.triggerConfig || "{}");
      days = cfg.days ? ` ${cfg.days}d in "${rule.stage?.name ?? "stage"}"` : "";
    } catch {}
    return `${base}${days}`;
  }
  return base;
}

export function AutomationsClient({
  initialRules,
  stages,
  templates,
}: {
  initialRules: AutomationRow[];
  stages: StageOption[];
  templates: TemplateOption[];
}) {
  const [rules, setRules] = useState<AutomationRow[]>(initialRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreated = useCallback((rule: AutomationRow) => {
    setRules((prev) => [...prev, rule]);
  }, []);

  async function handleToggle(rule: AutomationRow) {
    setTogglingId(rule.id);
    const newActive = !rule.isActive;
    // Optimistic
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, isActive: newActive } : r))
    );
    try {
      const res = await fetch(`/api/automations/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !newActive } : r))
      );
      toast.error("Failed to update automation");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(rule: AutomationRow) {
    if (!confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    setDeletingId(rule.id);
    try {
      const res = await fetch(`/api/automations/${rule.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast.success("Automation deleted");
    } catch {
      toast.error("Failed to delete automation");
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {rules.length === 0
                ? "Trigger emails automatically based on client activity."
                : `${activeCount} of ${rules.length} automation${rules.length !== 1 ? "s" : ""} active`}
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Automation
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No automations yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Set up automated emails that fire when clients reach certain milestones.
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Automation
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-w-2xl">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border border-border/60 bg-background px-4 py-3.5 transition-all",
                  !rule.isActive && "opacity-60"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
                    rule.triggerType === "WEEKLY_SUMMARY"
                      ? rule.isActive ? "bg-violet-50" : "bg-muted"
                      : rule.isActive ? "bg-yellow-50" : "bg-muted"
                  )}
                >
                  {rule.triggerType === "WEEKLY_SUMMARY" ? (
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        rule.isActive ? "text-violet-500" : "text-muted-foreground"
                      )}
                    />
                  ) : (
                    <Zap
                      className={cn(
                        "h-4 w-4",
                        rule.isActive ? "text-yellow-500" : "text-muted-foreground"
                      )}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{rule.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="truncate">{triggerDescription(rule)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {rule.triggerType === "WEEKLY_SUMMARY"
                        ? <span className="font-medium text-violet-600">AI Summary (Claude)</span>
                        : <>Send <span className="font-medium text-foreground">{rule.template?.name ?? "email"}</span></>
                      }
                    </span>
                  </div>
                </div>

                {/* Toggle + Delete */}
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => handleToggle(rule)}
                    disabled={togglingId === rule.id}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-opacity"
                    onClick={() => handleDelete(rule)}
                    disabled={deletingId === rule.id}
                  >
                    {deletingId === rule.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AutomationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        stages={stages}
        templates={templates}
        onCreated={handleCreated}
      />
    </div>
  );
}
