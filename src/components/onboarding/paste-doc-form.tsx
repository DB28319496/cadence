"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { pollOnboardingStatus } from "./poll-status";

const MAX_CHARS = 12_000;
const MIN_CHARS = 40;

export function PasteDocForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const tooShort = text.trim().length < MIN_CHARS;
  const overLimit = text.length > MAX_CHARS;

  const submit = async () => {
    if (tooShort || overLimit || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Couldn't build a workspace from that text");
        return;
      }

      // Serverless: extraction + generation run in the background — poll.
      if (json.status === "processing") {
        const result = await pollOnboardingStatus();
        if (result === "done") {
          toast.success("Your workspace is ready!");
          router.push("/dashboard");
          router.refresh();
        } else if (result === "failed") {
          toast.error("We couldn't build a workspace from that. Please try again.");
        } else {
          toast.error(
            "This is taking longer than expected. Check your dashboard in a moment."
          );
        }
        return;
      }

      toast.success("Your workspace is ready!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
      <div className="space-y-3">
        <Label htmlFor="doc" className="text-sm">
          Paste a description of your business, an SOP, or your process doc.
        </Label>
        <Textarea
          id="doc"
          placeholder="We're a done-for-you bookkeeping firm for restaurants. New clients sign, then we collect their bank and POS access, do a cleanup of the prior year, set up monthly close, and deliver a monthly report. Clients often stall on giving us access, and we forget to chase the missing statements..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          rows={12}
          maxLength={MAX_CHARS}
          className="resize-none"
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            We&apos;ll read it, infer your stages and pain points, and build a tailored workspace.
          </span>
          <span
            className={
              overLimit ? "text-destructive font-medium" : "text-muted-foreground"
            }
          >
            {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-6 border-t border-border">
        <Button
          type="button"
          onClick={submit}
          disabled={tooShort || overLimit || loading}
          className="h-10 font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Building your workspace...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate from document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
