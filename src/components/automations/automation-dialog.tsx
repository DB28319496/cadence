"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export type StageOption = { id: string; name: string; pipelineName: string };
export type TemplateOption = { id: string; name: string };

export type AutomationRow = {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: string;
  triggerConfig: string;
  actionType: string;
  templateId: string | null;
  stageId: string | null;
  template: { id: string; name: string } | null;
  stage: { id: string; name: string } | null;
};

const TRIGGER_TYPES = [
  { value: "CLIENT_CREATED", label: "Client is created" },
  { value: "STAGE_ENTRY", label: "Client enters a stage" },
  { value: "TIME_IN_STAGE", label: "Client has been in a stage for N days" },
  { value: "WEEKLY_SUMMARY", label: "Weekly AI summary (every Monday)" },
];

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  triggerType: z.enum(["CLIENT_CREATED", "STAGE_ENTRY", "TIME_IN_STAGE", "WEEKLY_SUMMARY"]),
  stageId: z.string().optional(),
  days: z.coerce.number().int().min(1).optional(),
  templateId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AutomationDialog({
  open,
  onClose,
  stages,
  templates,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  stages: StageOption[];
  templates: TemplateOption[];
  onCreated: (rule: AutomationRow) => void;
}) {
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: "",
      triggerType: "CLIENT_CREATED",
      stageId: "",
      templateId: "",
    },
  });

  const triggerType = form.watch("triggerType");
  const needsStage = triggerType === "STAGE_ENTRY" || triggerType === "TIME_IN_STAGE";
  const needsDays = triggerType === "TIME_IN_STAGE";
  const isWeeklySummary = triggerType === "WEEKLY_SUMMARY";

  useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        triggerType: "CLIENT_CREATED",
        stageId: "",
        templateId: "",
      });
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    if (needsStage && !values.stageId) {
      form.setError("stageId", { message: "Stage is required" });
      return;
    }
    if (needsDays && !values.days) {
      form.setError("days", { message: "Days is required" });
      return;
    }
    if (!isWeeklySummary && !values.templateId) {
      form.setError("templateId", { message: "Template is required" });
      return;
    }

    const triggerConfig: Record<string, unknown> = {};
    if (needsStage && values.stageId) triggerConfig.stageId = values.stageId;
    if (needsDays && values.days) triggerConfig.days = values.days;

    setSaving(true);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          triggerType: values.triggerType,
          triggerConfig,
          actionType: isWeeklySummary ? "AI_SUMMARY" : "SEND_EMAIL",
          actionConfig: {},
          templateId: isWeeklySummary ? undefined : values.templateId,
          stageId: needsStage ? (values.stageId ?? null) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const rule = await res.json();
      toast.success("Automation created");
      onCreated(rule);
      onClose();
    } catch {
      toast.error("Failed to create automation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Automation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Name *</FormLabel>
                  <FormControl>
                    <Input {...field} className="h-9" placeholder="e.g. Welcome Email Sequence" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="triggerType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Trigger *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {needsStage && (
              <FormField
                control={form.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Stage *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            <span className="text-muted-foreground ml-1 text-xs">
                              — {s.pipelineName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsDays && (
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Days in stage *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : e.target.value)
                        }
                        className="h-9"
                        placeholder="e.g. 3"
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isWeeklySummary ? (
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                <div className="text-sm text-violet-800">
                  <p className="font-medium">AI-Generated Summary</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    Every Monday, Claude automatically writes a personalized business summary
                    and emails it to all workspace owners and admins. No template needed.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Action:</span> Send email to client
                </div>

                <FormField
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email Template *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Create Automation
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
