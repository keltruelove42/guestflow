/**
 * Lightweight disposable/throwaway email domain blocklist for signup abuse
 * control. Not exhaustive — a first line against the common ones used to farm
 * free-trial accounts. Extend as needed, or swap for a maintained list/service.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "getnada.com",
  "trashmail.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mohmal.com",
  "mintemail.com",
  "spamgourmet.com",
  "tempinbox.com",
  "emailondeck.com",
  "moakt.com",
  "mailnesia.com",
  "tempr.email",
  "burnermail.io",
  "1secmail.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}
