/**
 * Platform-admin identity. The platform operator's email(s) — NOT org-level
 * roles. Overridable via PLATFORM_ADMIN_EMAILS (comma-separated).
 */

const DEFAULT_ADMIN_EMAILS = ["keltruelove42@gmail.com"];

export function platformAdminEmails(): string[] {
  const env = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  if (!env) return DEFAULT_ADMIN_EMAILS;
  return env
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}
