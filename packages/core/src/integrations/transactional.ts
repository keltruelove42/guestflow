import { ResendEmailSender } from "./resend";

/**
 * Platform transactional email (verification, password reset) — sent from
 * LeadCoda's OWN Resend identity, never a customer's sending domain. Uses
 * PLATFORM_RESEND_API_KEY (preferred) or RESEND_API_KEY, with EMAIL_FROM.
 * Falls back to console logging when neither key is configured (dev), so
 * signup never hard-fails on a missing key.
 */
export async function sendTransactionalEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean }> {
  const key =
    process.env.PLATFORM_RESEND_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "LeadCoda <onboarding@resend.dev>";
  if (!key) {
    console.warn(`[transactional] email not configured — would send to ${msg.to}: ${msg.subject}`);
    return { sent: false };
  }
  const sender = new ResendEmailSender(key, from);
  await sender.send({ to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
  return { sent: true };
}
