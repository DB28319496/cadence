import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: true });
  }

  // Invalidate existing unused tokens for this email
  await prisma.passwordResetToken.updateMany({
    where: { email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = await prisma.passwordResetToken.create({
    data: {
      email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3002";
  const resetUrl = `${appUrl}/reset-password/${token.token}`;

  await sendEmail({
    to: email,
    subject: "Reset your Cadence password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1E3A5F">Reset your password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1E3A5F;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        <p style="color:#999;font-size:12px">Or copy this link: ${resetUrl}</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
