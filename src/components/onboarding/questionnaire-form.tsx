"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Briefcase,
  Workflow,
  AlertCircle,
  MessageSquare,
  Users,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Answers = {
  businessType: string;
  services: string;
  clientJourney: string;
  painPoints: string;
  tone: "formal" | "professional" | "friendly";
  teamSize: string;
};

const TOTAL_STEPS = 6;

const TEAM_SIZES = ["Just me", "2–5 people", "6–20 people", "21–50 people", "50+ people"];

const TONE_OPTIONS: Array<{ value: Answers["tone"]; label: string; description: string }> = [
  {
    value: "formal",
    label: "Formal",
    description: "Polished and professional — no contractions, respectful distance",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Warm but business-like — clear and respectful",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Casual and conversational — approachable and relaxed",
  },
];

export function QuestionnaireForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const [answers, setAnswers] = useState<Answers>({
    businessType: "",
    services: "",
    clientJourney: "",
    painPoints: "",
    tone: "professional",
    teamSize: "",
  });

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return answers.businessType.trim().length > 0;
      case 2:
        return answers.services.trim().length >= 10;
      case 3:
        return answers.clientJourney.trim().length >= 10;
      case 4:
        return answers.painPoints.trim().length >= 5;
      case 5:
        return !!answers.tone;
      case 6:
        return !!answers.teamSize;
      default:
        return false;
    }
  };

  const next = () => {
    if (!isStepValid()) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  const submit = async () => {
    if (!isStepValid()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate your workspace");
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

  const stepIcons = [Briefcase, FileText, Workflow, AlertCircle, MessageSquare, Users];
  const StepIcon = stepIcons[step - 1];

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          AI-Powered Setup
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Let&apos;s build your workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Answer a few quick questions about your business and our AI will create a custom pipeline, email templates, and automations tailored to your workflow.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="font-medium">
            Step {step} of {TOTAL_STEPS}
          </span>
          <span>{Math.round((step / TOTAL_STEPS) * 100)}% complete</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <StepIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {step === 1 && "What kind of business do you run?"}
              {step === 2 && "What services do you offer?"}
              {step === 3 && "Walk us through your client journey"}
              {step === 4 && "What takes the most time or causes headaches?"}
              {step === 5 && "How do you communicate with clients?"}
              {step === 6 && "How big is your team?"}
            </h2>
          </div>
        </div>

        {/* Step 1: Business Type */}
        {step === 1 && (
          <div className="space-y-3">
            <Label htmlFor="businessType" className="text-sm">
              Your industry or business type
            </Label>
            <Input
              id="businessType"
              placeholder="e.g. Real estate agency, Law firm, Marketing consultancy, Home remodeling..."
              value={answers.businessType}
              onChange={(e) => update("businessType", e.target.value)}
              autoFocus
              maxLength={500}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Be as specific as you like — &ldquo;boutique family law firm&rdquo; works better than just &ldquo;law firm&rdquo;.
            </p>
          </div>
        )}

        {/* Step 2: Services */}
        {step === 2 && (
          <div className="space-y-3">
            <Label htmlFor="services" className="text-sm">
              Describe what you offer
            </Label>
            <Textarea
              id="services"
              placeholder="We help homeowners buy and sell residential properties in the Austin metro area. Our main services include listing prep, buyer representation, and closing coordination..."
              value={answers.services}
              onChange={(e) => update("services", e.target.value)}
              autoFocus
              rows={5}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              A few sentences is perfect. The more detail, the better the AI can tailor your workspace.
            </p>
          </div>
        )}

        {/* Step 3: Client Journey */}
        {step === 3 && (
          <div className="space-y-3">
            <Label htmlFor="clientJourney" className="text-sm">
              What happens from a client&apos;s first inquiry to project completion?
            </Label>
            <Textarea
              id="clientJourney"
              placeholder="First, they submit an inquiry on our website. Then we schedule a consultation call, send them a questionnaire, tour properties together, submit offers, go under contract, and finally close..."
              value={answers.clientJourney}
              onChange={(e) => update("clientJourney", e.target.value)}
              autoFocus
              rows={5}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Walk us through the key stages. Don&apos;t worry about being exhaustive — the AI will fill in the details.
            </p>
          </div>
        )}

        {/* Step 4: Pain Points */}
        {step === 4 && (
          <div className="space-y-3">
            <Label htmlFor="painPoints" className="text-sm">
              What slows you down or slips through the cracks?
            </Label>
            <Textarea
              id="painPoints"
              placeholder="Clients often go quiet after we send proposals. We forget to follow up. Document collection is a mess and we have to chase people for signatures..."
              value={answers.painPoints}
              onChange={(e) => update("painPoints", e.target.value)}
              autoFocus
              rows={5}
              maxLength={2000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll build automations to address these specific issues.
            </p>
          </div>
        )}

        {/* Step 5: Tone */}
        {step === 5 && (
          <div className="space-y-3">
            <Label className="text-sm">
              Choose the tone for your client emails
            </Label>
            <div className="space-y-2">
              {TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("tone", option.value)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    answers.tone === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{option.label}</span>
                    {answers.tone === option.value && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Team Size */}
        {step === 6 && (
          <div className="space-y-3">
            <Label className="text-sm">How many people work at your company?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => update("teamSize", size)}
                  className={`rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                    answers.teamSize === size
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={step === 1 || loading}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={next}
              disabled={!isStepValid() || loading}
              className="h-10"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={submit}
              disabled={!isStepValid() || loading}
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
                  Generate with AI
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Skip link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={skip}
          disabled={loading || skipping}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {skipping ? "Skipping..." : "Skip for now — I'll set up manually"}
        </button>
      </div>
    </div>
  );
}
