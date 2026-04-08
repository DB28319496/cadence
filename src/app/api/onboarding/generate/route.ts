import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWorkspaceFromAnswers } from "@/lib/onboarding-ai";

const answersSchema = z.object({
  businessType: z.string().min(1).max(200),
  services: z.string().min(10).max(2000),
  clientJourney: z.string().min(10).max(2000),
  painPoints: z.string().min(5).max(2000),
  tone: z.enum(["formal", "professional", "friendly"]),
  teamSize: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = answersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  if (member.workspace.onboardingCompleted) {
    return NextResponse.json(
      { error: "Onboarding already completed" },
      { status: 400 }
    );
  }

  // Call Claude to generate the configuration
  const generated = await generateWorkspaceFromAnswers(parsed.data);
  if (!generated) {
    return NextResponse.json(
      { error: "Failed to generate workspace. Please try again or skip setup." },
      { status: 502 }
    );
  }

  // Persist everything in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Clear any existing starter content (from signup defaults)
      await tx.automationRule.deleteMany({ where: { workspaceId: member.workspaceId } });
      await tx.emailTemplate.deleteMany({ where: { workspaceId: member.workspaceId } });
      await tx.stage.deleteMany({
        where: { pipeline: { workspaceId: member.workspaceId } },
      });
      await tx.pipeline.deleteMany({ where: { workspaceId: member.workspaceId } });

      // Create pipeline
      const pipeline = await tx.pipeline.create({
        data: {
          name: generated.pipeline.name,
          description: generated.pipeline.description,
          isDefault: true,
          isActive: true,
          workspaceId: member.workspaceId,
        },
      });

      // Create stages
      const stageByName = new Map<string, string>();
      for (let i = 0; i < generated.stages.length; i++) {
        const s = generated.stages[i];
        const checklistWithIds = s.checklist.map((item, idx) => ({
          id: `${s.name.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
          title: item.title,
          isRequired: item.isRequired,
          assignedTo: item.assignedTo,
        }));

        const stage = await tx.stage.create({
          data: {
            name: s.name,
            description: s.description,
            color: s.color,
            daysExpected: s.daysExpected,
            order: i,
            checklist: JSON.stringify(checklistWithIds),
            pipelineId: pipeline.id,
          },
        });
        stageByName.set(s.name, stage.id);
      }

      // Create email templates
      const templateByName = new Map<string, string>();
      for (const t of generated.emailTemplates) {
        const template = await tx.emailTemplate.create({
          data: {
            name: t.name,
            subject: t.subject,
            body: t.body,
            type: t.type,
            isActive: true,
            workspaceId: member.workspaceId,
          },
        });
        templateByName.set(t.name, template.id);
      }

      // Create automation rules
      for (const rule of generated.automationRules) {
        const templateId = templateByName.get(rule.templateName);
        if (!templateId) continue; // skip rules with invalid template refs

        const stageId = rule.triggerStageName
          ? stageByName.get(rule.triggerStageName)
          : undefined;

        const triggerConfig: Record<string, unknown> = {};
        if (rule.triggerType === "STAGE_ENTRY" && stageId) {
          triggerConfig.stageId = stageId;
        } else if (rule.triggerType === "TIME_IN_STAGE") {
          if (stageId) triggerConfig.stageId = stageId;
          if (rule.triggerDays) triggerConfig.days = rule.triggerDays;
        }

        await tx.automationRule.create({
          data: {
            name: rule.name,
            triggerType: rule.triggerType,
            triggerConfig: JSON.stringify(triggerConfig),
            actionType: "SEND_EMAIL",
            actionConfig: JSON.stringify({ templateId }),
            stageId: stageId ?? null,
            templateId,
            isActive: true,
            workspaceId: member.workspaceId,
          },
        });
      }

      // Mark onboarding complete
      await tx.workspace.update({
        where: { id: member.workspaceId },
        data: { onboardingCompleted: true },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Onboarding generate] DB error:", err);
    return NextResponse.json(
      { error: "Failed to save workspace configuration" },
      { status: 500 }
    );
  }
}
