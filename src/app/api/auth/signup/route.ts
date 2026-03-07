import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password, companyName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const baseSlug = slugify(companyName);

    // Ensure slug is unique
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: companyName,
          slug,
          emailFromName: companyName,
        },
      });

      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      // Auto-create weekly AI summary rule for new workspaces
      await tx.automationRule.create({
        data: {
          name: "Weekly AI Summary",
          triggerType: "WEEKLY_SUMMARY",
          triggerConfig: JSON.stringify({}),
          actionType: "AI_SUMMARY",
          actionConfig: JSON.stringify({}),
          workspaceId: workspace.id,
        },
      });
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[signup error]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
