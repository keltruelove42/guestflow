import { prisma } from "@guestflow/db";
import { escapeHtml } from "../messaging/render";
import { sendTransactionalEmail } from "../integrations/transactional";
import { EMAIL_VERIFY_TTL_MS, generateToken, hashToken } from "./tokens";

/**
 * Issue a fresh email-verification token for a user, store its hash, and send
 * the verification link from the platform's transactional sender.
 */
export async function issueEmailVerification(userId: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  if (!user) throw new Error("User not found");
  if (user.emailVerifiedAt) return { sent: false }; // already verified

  const { raw, hash } = generateToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyHash: hash,
      emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
    },
  });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/verify-email?token=${raw}`;
  const name = escapeHtml((user.name ?? "").split(" ")[0] || "there");

  return sendTransactionalEmail({
    to: user.email,
    subject: "Verify your email for LeadCoda",
    text: `Hi ${(user.name ?? "").split(" ")[0] || "there"},\n\nConfirm your email to activate sending on your LeadCoda account:\n${link}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html: `<p>Hi ${name},</p><p>Confirm your email to activate sending on your LeadCoda account:</p><p><a href="${escapeHtml(link)}">Verify my email</a></p><p style="color:#8a8aa0;font-size:12px">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
  });
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Consume a verification token: mark the user verified if it's valid. */
export async function consumeEmailVerification(rawToken: string): Promise<VerifyResult> {
  const token = (rawToken ?? "").trim();
  if (!token) return { ok: false, reason: "invalid" };

  const user = await prisma.user.findFirst({
    where: { emailVerifyHash: hashToken(token) },
    select: { id: true, emailVerifiedAt: true, emailVerifyExpires: true },
  });
  if (!user) return { ok: false, reason: "invalid" };
  if (user.emailVerifiedAt) return { ok: true }; // idempotent success
  if (!user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyHash: null,
      emailVerifyExpires: null,
    },
  });
  return { ok: true };
}

/** Whether an org has at least one verified user (its owner). */
export async function orgEmailVerified(orgId: string): Promise<boolean> {
  const verified = await prisma.user.count({
    where: { orgId, emailVerifiedAt: { not: null } },
  });
  return verified > 0;
}
