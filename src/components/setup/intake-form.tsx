"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VERTICAL_OPTIONS = [
  { value: "auto", label: "Auto repair" },
  { value: "hvac", label: "HVAC" },
  { value: "home_services", label: "Home services" },
];

export function IntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // paste mode
  const [pasteText, setPasteText] = useState("");

  // form mode
  const [businessName, setBusinessName] = useState("");
  const [vertical, setVertical] = useState("auto");
  const [city, setCity] = useState("");
  const [hours, setHours] = useState("");
  const [services, setServices] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  async function submit(body: unknown) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/setup/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to start run");
        return;
      }
      toast.success("Run started");
      router.push(`/setup/${data.runId}`);
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Tabs defaultValue="paste" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="paste">Paste a doc</TabsTrigger>
        <TabsTrigger value="form">Fill a form</TabsTrigger>
      </TabsList>

      <TabsContent value="paste" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="paste">Intake notes / document</Label>
          <Textarea
            id="paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste raw intake notes here — business name, what they do, hours, services, phone numbers, anything you have…"
            className="min-h-[260px] font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            The engine reads this, derives the business + vertical, and fills the config. Missing required fields will block the run for you to fix.
          </p>
        </div>
        <Button
          onClick={() => submit({ mode: "paste", text: pasteText })}
          disabled={submitting || !pasteText.trim()}
        >
          {submitting ? "Starting…" : "Start run"}
        </Button>
      </TabsContent>

      <TabsContent value="form" className="space-y-4 pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name *</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vertical">Vertical *</Label>
            <Select value={vertical} onValueChange={setVertical}>
              <SelectTrigger id="vertical">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERTICAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Hours</Label>
            <Input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon-Fri 8-6" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="services">Services</Label>
            <Input id="services" value={services} onChange={(e) => setServices(e.target.value)} placeholder="Diagnostics, brake repair, oil change…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Business phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerPhone">Owner phone</Label>
            <Input id="ownerPhone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() =>
            submit({
              mode: "form",
              form: { businessName, vertical, city, hours, services, phone, ownerPhone },
            })
          }
          disabled={submitting || !businessName.trim()}
        >
          {submitting ? "Starting…" : "Start run"}
        </Button>
      </TabsContent>
    </Tabs>
  );
}
