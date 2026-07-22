"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UpgradeChip } from "@/components/upgrade";

/**
 * Go-live wizard: white-labeled sending. The customer gets their own
 * email domain + phone number provisioned through LeadCoda's platform
 * accounts, without ever touching Resend or Twilio.
 */

type DnsRecord = { record: string; name: string; type: string; value: string; status?: string };

type ManagedStatus = {
  emailConfigured: boolean;
  smsConfigured: boolean;
  email: {
    domain: string;
    from: string;
    fromName: string | null;
    status: "pending" | "verified" | "failed";
    records: DnsRecord[];
  } | null;
  sms: { fromNumber: string; businessName: string; a2pStatus: string } | null;
};

export function ManagedSendingCard() {
  const qc = useQueryClient();
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["managed-sending"],
    queryFn: async () => {
      const res = await fetch("/api/v1/messaging/managed/email");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ManagedStatus>;
    },
  });

  if (!status) return null;
  // Platform accounts not configured yet: hide the card entirely
  if (!status.emailConfigured && !status.smsConfigured) return null;

  const emailState = status.email;
  const smsState = status.sms;

  return (
    <div className="rounded-card border border-[var(--border)] bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xl">🚀</span>
        <h2 className="text-sm font-semibold">Send as your business</h2>
        <span className="rounded-pill bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[11px] text-accent">
          No accounts needed
        </span>
        <UpgradeChip />
      </div>
      <p className="mt-1.5 max-w-2xl text-xs text-ink-2">
        Your follow-ups can come from your own email domain and your own phone number. We set
        everything up for you, you never create a Resend or Twilio account.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Email domain */}
        {status.emailConfigured && (
          <div className="rounded-control border border-[var(--border)] bg-page p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">📧 Your email domain</div>
              {emailState?.status === "verified" ? (
                <span className="rounded-pill bg-[color-mix(in_srgb,var(--good)_18%,transparent)] px-2 py-0.5 text-[11px] text-[var(--good-text)]">
                  Live · {emailState.from}
                </span>
              ) : emailState ? (
                <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  Waiting on DNS
                </span>
              ) : (
                <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  Not set up
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {emailState?.status === "verified"
                ? "Follow-up emails send from your address."
                : emailState
                  ? `Add the DNS records for ${emailState.domain}, then check again.`
                  : "Emails send from your domain, like you@yourbusiness.com."}
            </p>
            <button
              type="button"
              className="mt-3 rounded-control border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
              onClick={() => setEmailOpen(true)}
            >
              {emailState?.status === "verified" ? "Manage" : emailState ? "View DNS records" : "Set up email domain"}
            </button>
          </div>
        )}

        {/* Phone number */}
        {status.smsConfigured && (
          <div className="rounded-control border border-[var(--border)] bg-page p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">📱 Your text number</div>
              {smsState ? (
                <span className="rounded-pill bg-[color-mix(in_srgb,var(--good)_18%,transparent)] px-2 py-0.5 text-[11px] text-[var(--good-text)]">
                  Live · {smsState.fromNumber}
                </span>
              ) : (
                <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  Not set up
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">
              {smsState
                ? smsState.a2pStatus === "approved"
                  ? "Carrier registration approved."
                  : "Number is live. Carrier registration in progress, delivery improves once approved."
                : "We assign your business a local texting number in about a minute."}
            </p>
            {!smsState && (
              <button
                type="button"
                className="mt-3 rounded-control border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                onClick={() => setSmsOpen(true)}
              >
                Set up texting
              </button>
            )}
          </div>
        )}
      </div>

      {emailOpen && (
        <EmailDomainModal
          state={emailState}
          onClose={() => {
            setEmailOpen(false);
            qc.invalidateQueries({ queryKey: ["managed-sending"] });
          }}
        />
      )}
      {smsOpen && (
        <SmsSetupModal
          onClose={() => {
            setSmsOpen(false);
            qc.invalidateQueries({ queryKey: ["managed-sending"] });
          }}
        />
      )}
    </div>
  );
}

function EmailDomainModal({
  state,
  onClose,
}: {
  state: ManagedStatus["email"];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [domain, setDomain] = useState(state?.domain ?? "");
  const [fromLocal, setFromLocal] = useState(state?.from?.split("@")[0] ?? "hello");
  const [fromName, setFromName] = useState(state?.fromName ?? "");
  const [records, setRecords] = useState<DnsRecord[]>(state?.records ?? []);
  const [phase, setPhase] = useState<"form" | "records" | "verified">(
    state?.status === "verified" ? "verified" : state ? "records" : "form",
  );
  const [error, setError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/messaging/managed/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, fromLocal, fromName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not register domain");
      return data as { records: DnsRecord[]; status: string };
    },
    onSuccess: (data) => {
      setError(null);
      setRecords(data.records ?? []);
      setPhase(data.status === "verified" ? "verified" : "records");
      qc.invalidateQueries({ queryKey: ["managed-sending"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const verify = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/messaging/managed/email", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      return data as { records: DnsRecord[]; status: string };
    },
    onSuccess: (data) => {
      setError(null);
      setRecords(data.records ?? []);
      if (data.status === "verified") setPhase("verified");
      qc.invalidateQueries({ queryKey: ["managed-sending"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">Send email as your business</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          {phase === "form" && (
            <>
              <p className="text-xs text-ink-2">
                Enter the domain your business uses. We register it for sending, then you add 3
                DNS records wherever your domain lives (GoDaddy, Namecheap, Squarespace...).
                That is the only step we cannot do for you, it is how the internet proves you
                own the domain.
              </p>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-2">Your domain</label>
                <input
                  className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  placeholder="yourbusiness.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Send from
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                      value={fromLocal}
                      onChange={(e) => setFromLocal(e.target.value)}
                    />
                    <span className="text-xs text-muted">@{domain || "domain"}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    From name (optional)
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    placeholder="e.g. Coda Motors"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-critical">{error}</p>}
              <button
                type="button"
                disabled={register.isPending}
                className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => register.mutate()}
              >
                {register.isPending ? "Registering…" : "Register domain →"}
              </button>
            </>
          )}

          {phase === "records" && (
            <>
              <p className="text-xs text-ink-2">
                Add these records in your domain provider's DNS settings, then hit Check. DNS
                can take a few minutes to a few hours to propagate, feel free to close this and
                check back later.
              </p>
              <div className="space-y-2">
                {records.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-control border border-[var(--border)] bg-page p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-pill bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase">
                        {r.type}
                      </span>
                      {r.status === "verified" && (
                        <span className="text-[var(--good-text)]">✓ found</span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-muted">Name</span>
                        <code className="break-all">{r.name}</code>
                        <button
                          type="button"
                          className="ml-auto shrink-0 text-accent"
                          onClick={() => navigator.clipboard.writeText(r.name)}
                        >
                          copy
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-muted">Value</span>
                        <code className="break-all">{r.value}</code>
                        <button
                          type="button"
                          className="ml-auto shrink-0 text-accent"
                          onClick={() => navigator.clipboard.writeText(r.value)}
                        >
                          copy
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {error && <p className="text-sm text-critical">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={verify.isPending}
                  className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  onClick={() => verify.mutate()}
                >
                  {verify.isPending ? "Checking…" : "Check verification"}
                </button>
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
                  onClick={() => setPhase("form")}
                >
                  Change domain
                </button>
              </div>
            </>
          )}

          {phase === "verified" && (
            <div className="rounded-control bg-[color-mix(in_srgb,var(--good)_12%,transparent)] p-4 text-sm">
              <div className="font-semibold text-[var(--good-text)]">
                ✓ Your domain is verified
              </div>
              <p className="mt-1 text-xs text-ink-2">
                Follow-up emails now send from {fromLocal}@{domain}. Nothing else to do.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SmsSetupModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    businessName: "",
    businessType: "llc",
    ein: "",
    website: "",
    address: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    areaCode: "",
  });
  const [result, setResult] = useState<{ fromNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provision = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/messaging/managed/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      return data as { fromNumber: string };
    },
    onSuccess: (data) => {
      setError(null);
      setResult(data);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">Set up texting for your business</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          {result ? (
            <div className="rounded-control bg-[color-mix(in_srgb,var(--good)_12%,transparent)] p-4 text-sm">
              <div className="font-semibold text-[var(--good-text)]">
                ✓ Your number is live: {result.fromNumber}
              </div>
              <p className="mt-1 text-xs text-ink-2">
                Texts now send from this number. We also submitted your business for carrier
                registration (A2P), which improves delivery rates once approved, usually within
                a few days. Nothing else to do.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-2">
                US carriers require business registration before automated texting. Fill this
                in once, we assign you a local number and handle the registration.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Legal business name
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={form.businessName}
                    onChange={set("businessName")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Business type
                  </label>
                  <select
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={form.businessType}
                    onChange={set("businessType")}
                  >
                    <option value="sole_prop">Sole proprietor</option>
                    <option value="llc">LLC</option>
                    <option value="corporation">Corporation</option>
                    <option value="partnership">Partnership</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    EIN (optional for sole props)
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    placeholder="12-3456789"
                    value={form.ein}
                    onChange={set("ein")}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Business address
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={form.address}
                    onChange={set("address")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Contact name
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={form.contactName}
                    onChange={set("contactName")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Contact email
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={form.contactEmail}
                    onChange={set("contactEmail")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Contact phone
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    placeholder="+1..."
                    value={form.contactPhone}
                    onChange={set("contactPhone")}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-2">
                    Preferred area code (optional)
                  </label>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    placeholder="704"
                    value={form.areaCode}
                    onChange={set("areaCode")}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-critical">{error}</p>}
              <button
                type="button"
                disabled={provision.isPending}
                className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => provision.mutate()}
              >
                {provision.isPending ? "Setting up…" : "Get my number →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
