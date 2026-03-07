"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { ClientSlideOver } from "./client-slide-over";
import { AddClientDialog } from "./add-client-dialog";
import { AlertTriangle, Plus, Heart } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KanbanStage = {
  id: string;
  name: string;
  color: string;
  order: number;
  daysExpected: number | null;
  checklist: string | null;
};

export type KanbanClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  projectType: string | null;
  projectValue: number | null;
  currentStageId: string | null;
  stageEnteredAt: string;
  stageCompletions: Array<{ checklistItemId: string | null; stageId: string }>;
  assignedTo: { id: string; name: string | null; image: string | null } | null;
};

export type KanbanPipeline = {
  id: string;
  name: string;
  stages: KanbanStage[];
};

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({
  client,
  stage,
  onClick,
  isOverlay = false,
}: {
  client: KanbanClient;
  stage: KanbanStage | undefined;
  onClick: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  });

  const days = Math.floor(
    (Date.now() - new Date(client.stageEnteredAt).getTime()) / 86_400_000
  );
  const isOverdue = stage?.daysExpected != null && days > stage.daysExpected;

  const checklist: string[] = (() => {
    try {
      return stage?.checklist ? JSON.parse(stage.checklist) : [];
    } catch {
      return [];
    }
  })();
  const completions = client.stageCompletions.filter(
    (sc) => sc.stageId === client.currentStageId
  );
  const checklistPct =
    checklist.length > 0 ? Math.round((completions.length / checklist.length) * 100) : -1;

  // Health score: 0–100 based on days vs expected + checklist completion
  const healthScore = (() => {
    let score = 100;
    if (stage?.daysExpected && stage.daysExpected > 0) {
      const ratio = days / stage.daysExpected;
      if (ratio > 1.5) score -= 50;
      else if (ratio > 1.0) score -= 30;
      else if (ratio > 0.75) score -= 10;
    }
    if (checklistPct >= 0) score -= Math.round((1 - checklistPct / 100) * 20);
    return Math.max(0, Math.min(100, score));
  })();
  const healthColor =
    healthScore >= 75 ? "text-emerald-600 bg-emerald-50" :
    healthScore >= 45 ? "text-amber-600 bg-amber-50" :
    "text-red-600 bg-red-50";

  const initials = client.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const style =
    transform && !isOverlay
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : undefined;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      suppressHydrationWarning
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "group bg-background rounded-lg p-3 shadow-sm border border-border/60",
        "cursor-grab active:cursor-grabbing select-none transition-shadow",
        "hover:shadow-md hover:border-border",
        isOverdue && "border-l-[3px] border-l-red-500",
        isDragging && "opacity-40",
        isOverlay && "shadow-xl rotate-1 cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="font-medium text-sm leading-snug line-clamp-2 flex-1">
          {client.name}
        </span>
        {isOverdue && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
        )}
      </div>

      {client.projectType && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{client.projectType}</p>
      )}

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-xs font-semibold">
          {client.projectValue ? formatCurrency(client.projectValue) : "—"}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full font-medium",
              isOverdue
                ? "bg-red-100 text-red-700"
                : days <= 1
                ? "bg-emerald-100 text-emerald-700"
                : "bg-muted text-muted-foreground"
            )}
          >
            {days}d
          </span>
          {stage?.daysExpected != null && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded font-semibold",
                healthColor
              )}
              title={`Health: ${healthScore}/100`}
            >
              <Heart className="h-2.5 w-2.5" />
              {healthScore}
            </span>
          )}
        </div>
      </div>

      {checklistPct >= 0 && (
        <div className="mt-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                checklistPct === 100 ? "bg-emerald-500" : "bg-blue-500"
              )}
              style={{ width: `${checklistPct}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {completions.length}/{checklist.length} tasks
          </p>
        </div>
      )}

      {client.assignedTo && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
            {client.assignedTo.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="text-[10px] text-muted-foreground truncate">
            {client.assignedTo.name}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  clients,
  onClientClick,
  onAddClient,
}: {
  stage: KanbanStage;
  clients: KanbanClient[];
  onClientClick: (client: KanbanClient) => void;
  onAddClient: (stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = clients.reduce((sum, c) => sum + (c.projectValue ?? 0), 0);
  const overdueCount = clients.filter((c) => {
    const days = Math.floor(
      (Date.now() - new Date(c.stageEnteredAt).getTime()) / 86_400_000
    );
    return stage.daysExpected != null && days > stage.daysExpected;
  }).length;

  return (
    <div className="flex flex-col w-[272px] shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ background: stage.color }}
        />
        <span className="font-semibold text-sm truncate flex-1">{stage.name}</span>
        <div className="flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="text-[10px] bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">
              {overdueCount} late
            </span>
          )}
          <span className="text-xs text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-full">
            {clients.length}
          </span>
        </div>
      </div>

      {totalValue > 0 && (
        <p className="text-[11px] text-muted-foreground px-1 mb-2">
          {formatCurrency(totalValue)}
        </p>
      )}

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[120px] rounded-xl p-2 space-y-2 transition-colors duration-150",
          isOver ? "bg-accent/40 ring-2 ring-primary/20" : "bg-muted/30"
        )}
        style={{ borderTop: `3px solid ${stage.color}` }}
      >
        {clients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            stage={stage}
            onClick={() => onClientClick(client)}
          />
        ))}

        <button
          onClick={() => onAddClient(stage.id)}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 py-2 rounded-lg",
            "text-xs text-muted-foreground/60 hover:text-muted-foreground",
            "hover:bg-background/60 transition-colors",
            clients.length === 0 && "border border-dashed border-border/60"
          )}
        >
          <Plus className="h-3 w-3" />
          Add client
        </button>
      </div>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function KanbanBoard({
  pipeline,
  initialClients,
}: {
  pipeline: KanbanPipeline;
  initialClients: KanbanClient[];
}) {
  const [clients, setClients] = useState<KanbanClient[]>(initialClients);
  const [activeClient, setActiveClient] = useState<KanbanClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<KanbanClient | null>(null);
  const [addToStageId, setAddToStageId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const stageMap = Object.fromEntries(pipeline.stages.map((s) => [s.id, s]));

  const clientsByStage: Record<string, KanbanClient[]> = Object.fromEntries(
    pipeline.stages.map((s) => [s.id, []])
  );
  for (const client of clients) {
    if (client.currentStageId && clientsByStage[client.currentStageId]) {
      clientsByStage[client.currentStageId].push(client);
    }
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const client = clients.find((c) => c.id === event.active.id);
      setActiveClient(client ?? null);
    },
    [clients]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveClient(null);
      const { active, over } = event;
      if (!over) return;

      const clientId = active.id as string;
      const newStageId = over.id as string;
      const client = clients.find((c) => c.id === clientId);
      if (!client || client.currentStageId === newStageId) return;

      // Optimistic update
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId
            ? { ...c, currentStageId: newStageId, stageEnteredAt: new Date().toISOString() }
            : c
        )
      );

      try {
        const res = await fetch(`/api/clients/${clientId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: newStageId }),
        });
        if (!res.ok) throw new Error("Failed");
      } catch {
        // Revert on failure
        setClients(initialClients);
      }
    },
    [clients, initialClients]
  );

  const handleClientUpdated = useCallback((updated: KanbanClient) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelectedClient((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  const handleClientAdded = useCallback((newClient: KanbanClient) => {
    setClients((prev) => [...prev, newClient]);
  }, []);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full">
          {pipeline.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              clients={clientsByStage[stage.id] ?? []}
              onClientClick={setSelectedClient}
              onAddClient={setAddToStageId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeClient && (
            <ClientCard
              client={activeClient}
              stage={stageMap[activeClient.currentStageId ?? ""]}
              onClick={() => {}}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {selectedClient && (
        <ClientSlideOver
          clientId={selectedClient.id}
          pipeline={pipeline}
          onClose={() => setSelectedClient(null)}
          onClientUpdated={handleClientUpdated}
        />
      )}

      {addToStageId && (
        <AddClientDialog
          stageId={addToStageId}
          pipelineId={pipeline.id}
          onClose={() => setAddToStageId(null)}
          onClientAdded={handleClientAdded}
        />
      )}
    </>
  );
}
