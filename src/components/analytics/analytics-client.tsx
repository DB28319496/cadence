"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Users, DollarSign, TrendingUp, Mail, Trophy, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

type Summary = {
  totalClients: number;
  activeClients: number;
  pipelineValue: number;
  winRate: number | null;
  emailsSent: number;
  completedClients: number;
};

type StageStat = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  pipelineName: string;
  clientCount: number;
  totalValue: number;
  overdueCount: number;
  avgDays: number;
  daysExpected: number | null;
};

type MonthlyIntake = { month: string; count: number };
type StatusBreakdown = { status: string; label: string; count: number; value: number };

// ── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#3B82F6",
  COMPLETED: "#10B981",
  LOST: "#EF4444",
  ON_HOLD: "#F59E0B",
  ARCHIVED: "#94A3B8",
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center"
          style={{ background: accent ? `${accent}18` : undefined }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: accent ?? "currentColor" }}
          />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function StageTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StageStat }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-background shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{d.clientCount} active client{d.clientCount !== 1 ? "s" : ""}</p>
      {d.totalValue > 0 && <p className="text-muted-foreground">{formatCurrency(d.totalValue)} value</p>}
      {d.overdueCount > 0 && (
        <p className="text-red-600 font-medium">{d.overdueCount} overdue</p>
      )}
      {d.avgDays > 0 && (
        <p className="text-muted-foreground">
          {d.avgDays}d avg
          {d.daysExpected && ` / ${d.daysExpected}d expected`}
        </p>
      )}
    </div>
  );
}

function MonthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background shadow-lg p-3 text-xs">
      <p className="font-semibold">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} new client{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AnalyticsClient({
  summary,
  stageStats,
  monthlyIntake,
  statusBreakdown,
}: {
  summary: Summary;
  stageStats: StageStat[];
  monthlyIntake: MonthlyIntake[];
  statusBreakdown: StatusBreakdown[];
}) {
  const overdueStages = stageStats.filter((s) => s.overdueCount > 0);
  const activeStageStats = stageStats.filter((s) => s.clientCount > 0);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function fetchBottleneckInsights() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/bottleneck-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bottlenecks: overdueStages }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { insights: string };
      setAiInsights(data.insights);
    } catch {
      setAiInsights("Could not generate insights. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/50">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pipeline performance and client metrics.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Active Clients"
            value={String(summary.activeClients)}
            sub={`${summary.totalClients} total`}
            icon={Users}
            accent="#3B82F6"
          />
          <StatCard
            label="Pipeline Value"
            value={summary.pipelineValue > 0 ? formatCurrency(summary.pipelineValue) : "—"}
            sub="active clients only"
            icon={DollarSign}
            accent="#10B981"
          />
          <StatCard
            label="Win Rate"
            value={summary.winRate != null ? `${summary.winRate}%` : "—"}
            sub={`${summary.completedClients} completed`}
            icon={Trophy}
            accent="#F59E0B"
          />
          <StatCard
            label="Emails Sent"
            value={String(summary.emailsSent)}
            sub="via automations"
            icon={Mail}
            accent="#8B5CF6"
          />
        </div>

        {/* ── Charts row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Clients by Stage */}
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <p className="text-sm font-semibold mb-4">Active Clients by Stage</p>
            {activeStageStats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                No active clients
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(activeStageStats.length * 36, 140)}>
                <BarChart
                  layout="vertical"
                  data={activeStageStats}
                  margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={96}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<StageTooltip />} cursor={{ fill: "#f1f5f9" }} />
                  <Bar dataKey="clientCount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {activeStageStats.map((s) => (
                      <Cell key={s.id} fill={s.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pipeline Value by Stage */}
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <p className="text-sm font-semibold mb-4">Pipeline Value by Stage</p>
            {activeStageStats.filter((s) => s.totalValue > 0).length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                No project values set
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height={Math.max(activeStageStats.filter((s) => s.totalValue > 0).length * 36, 140)}
              >
                <BarChart
                  layout="vertical"
                  data={activeStageStats.filter((s) => s.totalValue > 0)}
                  margin={{ top: 0, right: 16, bottom: 0, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `$${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `$${Math.round(v / 1_000)}k`
                        : `$${v}`
                    }
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={96}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value) => [formatCurrency(value as number), "Value"]}
                  />
                  <Bar dataKey="totalValue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                    {activeStageStats
                      .filter((s) => s.totalValue > 0)
                      .map((s) => (
                        <Cell key={s.id} fill={s.color} fillOpacity={0.8} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Row 2 ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Intake */}
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <p className="text-sm font-semibold mb-4">New Clients — Last 6 Months</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyIntake} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<MonthTooltip />} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="count" fill="#4F8FD6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Breakdown */}
          <div className="rounded-xl border border-border/60 bg-background p-4">
            <p className="text-sm font-semibold mb-4">Client Status Breakdown</p>
            {statusBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                No clients yet
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {statusBreakdown.map((s) => (
                        <Cell
                          key={s.status}
                          fill={STATUS_COLORS[s.status] ?? "#94A3B8"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  {statusBreakdown
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <div key={s.status} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: STATUS_COLORS[s.status] ?? "#94A3B8" }}
                          />
                          <span className="text-xs truncate">{s.label}</span>
                        </div>
                        <span className="text-xs font-semibold shrink-0">{s.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stage Bottlenecks ───────────────────────────────────────────── */}
        {overdueStages.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background">
            <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border/50">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold">Stage Bottlenecks</p>
              <span className="ml-auto text-xs text-muted-foreground">
                Stages with overdue clients
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {overdueStages.map((s) => {

                const pct = s.clientCount > 0
                  ? Math.round((s.overdueCount / s.clientCount) * 100)
                  : 0;
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: s.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.pipelineName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{s.clientCount}</p>
                      <p className="text-xs text-muted-foreground">clients</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold", s.overdueCount > 0 && "text-red-600")}>
                        {s.overdueCount}
                      </p>
                      <p className="text-xs text-muted-foreground">overdue</p>
                    </div>
                    <div className="text-right w-16">
                      <p className="text-sm font-semibold">{s.avgDays}d</p>
                      <p className="text-xs text-muted-foreground">
                        avg{s.daysExpected ? ` / ${s.daysExpected}d` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI Insights */}
            <div className="border-t border-border/50 px-4 py-3">
              {aiInsights ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="text-xs font-semibold text-violet-700">AI Recommendations</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 px-2 text-xs text-violet-600 hover:bg-violet-50"
                      onClick={fetchBottleneckInsights}
                      disabled={aiLoading}
                    >
                      {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                    {aiInsights}
                  </p>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={fetchBottleneckInsights}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Analyzing…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Get AI Recommendations</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── All Stages Performance Table ────────────────────────────────── */}
        {stageStats.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-background">
            <div className="px-4 pt-4 pb-3 border-b border-border/50">
              <p className="text-sm font-semibold">Stage Performance</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Stage</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Clients</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Value</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Avg Days</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Expected</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {stageStats.map((s) => (
                    <tr key={s.id} className={cn(s.clientCount === 0 && "opacity-40")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ background: s.color }}
                          />
                          <span className="font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.clientCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.totalValue > 0 ? formatCurrency(s.totalValue) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {s.avgDays > 0 ? `${s.avgDays}d` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.daysExpected ? `${s.daysExpected}d` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {s.overdueCount > 0 ? (
                          <span className="text-red-600 font-medium">{s.overdueCount}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
