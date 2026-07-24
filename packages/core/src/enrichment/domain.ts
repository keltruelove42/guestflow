/** Deterministic email-domain analysis — the free, always-on enrichment base. */

const FREE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
]);

export type DomainInfo = {
  domain: string | null;
  isBusinessEmail: boolean;
  /** Rough company-name guess from the domain (e.g. acme-plumbing.com → "Acme Plumbing"). */
  companyGuess: string | null;
};

export function analyzeEmailDomain(email: string | null | undefined): DomainInfo {
  const addr = (email ?? "").trim().toLowerCase();
  const domain = addr.includes("@") ? addr.split("@")[1] || null : null;
  if (!domain) return { domain: null, isBusinessEmail: false, companyGuess: null };

  const isBusiness = !FREE_DOMAINS.has(domain);
  let companyGuess: string | null = null;
  if (isBusiness) {
    const core = domain.split(".")[0] ?? "";
    companyGuess = core
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || null;
  }
  return { domain, isBusinessEmail: isBusiness, companyGuess };
}
