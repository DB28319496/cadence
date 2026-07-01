"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RotateCw, Check } from "lucide-react";

/** Refresh the run view on an interval while background work is in flight. */
export function RunPoller({ active, intervalMs = 4000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}

/**
 * While the run is `running`, drive it one step per request (serverless-safe:
 * each step is a single Claude call, well under the function timeout), refreshing
 * the view after each. Stops automatically once the run rests (blocked/failed/live)
 * — `active` flips false and the effect tears down. Calls never overlap.
 */
export function AutoAdvancer({ runId, active }: { runId: string; active: boolean }) {
  const router = useRouter();
  const busy = useRef(false);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      try {
        await fetch(`/api/setup/runs/${runId}/advance`, { method: "POST" });
      } catch {
        // transient — next tick retries
      } finally {
        busy.current = false;
      }
      if (!cancelled) router.refresh();
    };
    tick(); // kick immediately, don't wait a full interval
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, runId, router]);
  return null;
}

/** Edit the generated config (JSON) and re-run the brain (prompt + QA). */
export function ConfigEditor({ runId, config }: { runId: string; config: unknown }) {
  const router = useRouter();
  const initial = JSON.stringify(config, null, 2);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  let valid = true;
  try {
    JSON.parse(text);
  } catch {
    valid = false;
  }
  const dirty = text !== initial;

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast.error("Config is not valid JSON");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/setup/runs/${runId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Config update failed");
        return;
      }
      toast.success("Config saved — re-ran prompt + QA");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="min-h-[320px] font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy || !dirty || !valid}>
          {busy ? "Saving…" : "Save & re-run prompt + QA"}
        </Button>
        {!valid ? <span className="text-xs text-destructive">Invalid JSON</span> : null}
      </div>
    </div>
  );
}

/** Reset + re-run a single step (blocked/failed auto step). */
export function RetryButton({ runId, stepKey }: { runId: string; stepKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/setup/runs/${runId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: stepKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Retry failed");
        return;
      }
      toast.success("Re-ran step");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={retry} disabled={busy}>
      <RotateCw className="size-3.5" />
      {busy ? "Running…" : "Run / Retry"}
    </Button>
  );
}

/** Mark a manual task done -> resume the run. */
export function MarkDoneButton({ runId, stepKey }: { runId: string; stepKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function done() {
    setBusy(true);
    try {
      const res = await fetch(`/api/setup/runs/${runId}/steps/${stepKey}/done`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to mark done");
        return;
      }
      toast.success("Marked done — resuming");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" onClick={done} disabled={busy}>
      <Check className="size-3.5" />
      {busy ? "Working…" : "Mark done"}
    </Button>
  );
}

/** Submit the A2P brand + campaign with the client's EIN; starts approval polling. */
export function A2PForm({ runId }: { runId: string }) {
  const router = useRouter();
  const [ein, setEin] = useState("");
  const [brand, setBrand] = useState("");
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/setup/runs/${runId}/a2p`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein, brand: brand || undefined, campaign: campaign || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "A2P submission failed");
        return;
      }
      toast.success("A2P submitted — polling for approval");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ein" className="text-xs">EIN *</Label>
          <Input id="ein" value={ein} onChange={(e) => setEin(e.target.value)} placeholder="12-3456789" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand" className="text-xs">Brand (legal name)</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="defaults to business name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campaign" className="text-xs">Campaign</Label>
          <Input id="campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="defaults to bookings" />
        </div>
      </div>
      <Button size="sm" onClick={submit} disabled={busy || !ein.trim()}>
        {busy ? "Submitting…" : "Submit A2P"}
      </Button>
    </div>
  );
}

/** Edit the intake text and re-run the brain (generate_config -> qa_review). */
export function IntakeEditor({ runId, initialText }: { runId: string; initialText: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const dirty = text.trim() !== initialText.trim();

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/setup/runs/${runId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeText: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Update failed");
        return;
      }
      toast.success("Intake saved — re-ran the config");
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[180px] font-mono text-sm"
      />
      <Button size="sm" onClick={save} disabled={busy || !dirty || !text.trim()}>
        {busy ? "Saving…" : "Save & re-run from config"}
      </Button>
    </div>
  );
}
