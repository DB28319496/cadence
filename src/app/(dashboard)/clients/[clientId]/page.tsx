import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Calendar } from "lucide-react";
import { ClientEditForm } from "@/components/clients/client-edit-form";
import { ClientActivity } from "@/components/clients/client-activity";
import { ClientChecklist } from "@/components/clients/client-checklist";
import { ClientDocuments } from "@/components/clients/client-documents";
import { ClientAiSummary } from "@/components/clients/client-ai-summary";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-600",
  ON_HOLD: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-muted text-muted-foreground",
};

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ");
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    select: { workspaceId: true },
  });
  if (!member) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: { portalEnabled: true },
  });

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspaceId: member.workspaceId },
    include: {
      currentStage: true,
      pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
      assignedTo: { select: { id: true, name: true, image: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      stageCompletions: { select: { checklistItemId: true, stageId: true } },
    },
  });

  if (!client) notFound();

  const daysInStage = Math.floor(
    (Date.now() - new Date(client.stageEnteredAt).getTime()) / 86_400_000
  );
  const isOverdue =
    client.currentStage?.daysExpected != null &&
    daysInStage > client.currentStage.daysExpected;

  // Serialize for client components
  const serializedClient = {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    companyName: client.companyName,
    projectType: client.projectType,
    projectValue: client.projectValue,
    source: client.source,
    notes: client.notes,
    status: client.status,
    currentStageId: client.currentStageId,
    stageEnteredAt: client.stageEnteredAt.toISOString(),
    portalToken: client.portalToken,
    portalEnabled: workspace?.portalEnabled ?? false,
    pipeline: client.pipeline
      ? {
          id: client.pipeline.id,
          name: client.pipeline.name,
          stages: client.pipeline.stages.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            order: s.order,
          })),
        }
      : null,
  };

  const serializedActivities = client.activities.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    createdAt: a.createdAt.toISOString(),
    user: a.user,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/50">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Clients
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Status */}
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  STATUS_STYLES[client.status] ?? "bg-muted text-muted-foreground"
                )}
              >
                {statusLabel(client.status)}
              </span>

              {/* Stage */}
              {client.currentStage && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ background: client.currentStage.color }}
                >
                  {client.currentStage.name}
                </span>
              )}

              {/* Days in stage */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  isOverdue ? "text-red-600" : "text-muted-foreground"
                )}
              >
                {isOverdue && <AlertTriangle className="h-3 w-3" />}
                {daysInStage}d in stage
                {isOverdue && ` · ${daysInStage - (client.currentStage?.daysExpected ?? 0)}d overdue`}
              </span>

              {/* Pipeline */}
              {client.pipeline && (
                <span className="text-xs text-muted-foreground/60">
                  {client.pipeline.name}
                </span>
              )}
            </div>
          </div>

          {/* Key metrics */}
          <div className="flex items-center gap-4 shrink-0 text-right">
            {client.projectValue && (
              <div>
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-lg font-bold">{formatCurrency(client.projectValue)}</p>
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                <Calendar className="h-3 w-3" />
                Added
              </p>
              <p className="text-sm">{formatDate(client.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body: two-column */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] divide-y lg:divide-y-0 lg:divide-x divide-border/50">

          {/* Left: Edit form */}
          <div className="overflow-auto p-6">
            <ClientEditForm client={serializedClient} />
          </div>

          {/* Right: Checklist + Activity */}
          <div className="overflow-auto p-6 space-y-6">
            {/* AI Summary */}
            <ClientAiSummary clientId={client.id} />

            {/* Checklist */}
            {client.currentStage && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {client.currentStage.name} — Checklist
                </p>
                <ClientChecklist
                  clientId={client.id}
                  stageId={client.currentStage.id}
                  stageName={client.currentStage.name}
                  checklistJson={client.currentStage.checklist}
                  completions={client.stageCompletions}
                />
              </div>
            )}

            <div className="border-t border-border/50 pt-6">
              <ClientDocuments clientId={client.id} />
            </div>

            <div className="border-t border-border/50 pt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Activity
              </p>
              <ClientActivity
                clientId={client.id}
                initialActivities={serializedActivities}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
