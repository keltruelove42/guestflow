"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { ManagedSendingCard } from "@/components/managed-sending";
import { relativeTime } from "@/lib/format";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  required?: boolean;
  help?: string;
};

type Integration = {
  provider: string;
  name: string;
  desc: string;
  icon: string;
  bg: string;
  auth: "oauth" | "api_key" | "credentials";
  fields: FieldDef[];
  syncLive: boolean;
  docsUrl: string | null;
  setupHint: string | null;
  oauthReady: boolean;
  oauthOption?: boolean;
  comingSoon?: boolean;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  isDemo: boolean;
  hasCredentials: boolean;
};

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <IntegrationsInner />
    </Suspense>
  );
}

function IntegrationsInner() {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<Integration | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/integrations");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Integration[]>;
    },
  });

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setToast(`Connected ${connected}. Credentials encrypted and saved.`);
      onboarding?.markAction("integration");
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      window.history.replaceState({}, "", "/integrations");
    } else if (error) {
      setToast(`Connect failed: ${error}`);
      window.history.replaceState({}, "", "/integrations");
    }
    if (connected || error) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams, onboarding, qc]);

  const disconnect = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/v1/integrations/${provider}/disconnect`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Disconnect failed");
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      setToast("Disconnected");
      setTimeout(() => setToast(null), 3000);
    },
  });

  const sync = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetch(`/api/v1/integrations/${provider}/sync`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Sync failed");
      return d as { status: string; lastError: string | null };
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      setToast(
        d.status === "ERROR"
          ? `Sync error: ${d.lastError ?? "failed"}`
          : "Sync complete",
      );
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e) => {
      setToast(e instanceof Error ? e.message : "Sync failed");
      setTimeout(() => setToast(null), 4000);
    },
  });

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-ink-2">
        Connect your ad platforms, PMS, and messaging tools. API keys and OAuth tokens are
        encrypted at rest. Demo badges are seed data, reconnect with your own credentials to go
        live.
      </p>

      <ManagedSendingCard />

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const on = i.status === "CONNECTED" || i.status === "ERROR";
          const live = on && i.hasCredentials && !i.isDemo;
          return (
            <div
              key={i.provider}
              className="flex flex-col rounded-card border border-[var(--border)] bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-control text-lg"
                  style={{ background: i.bg, color: "#fff" }}
                >
                  {i.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="truncate text-sm">{i.name}</b>
                    {i.isDemo && on && (
                      <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                        Demo
                      </span>
                    )}
                    {live && (
                      <span className="rounded-pill bg-[color-mix(in_srgb,var(--good)_18%,transparent)] px-1.5 text-[10px] text-[var(--good-text)]">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {i.auth === "oauth" ? "OAuth" : "API credentials"}
                  </div>
                </div>
              </div>
              <p className="mt-3 flex-1 text-xs leading-relaxed text-ink-2">{i.desc}</p>

              {i.lastError && (
                <p className="mt-2 rounded-control bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] px-2 py-1.5 text-[11px] text-critical">
                  {i.lastError}
                </p>
              )}

              <div className="mt-3 text-[11px] text-muted">
                {i.lastSyncAt
                  ? `Last sync ${relativeTime(i.lastSyncAt)}`
                  : "Not synced yet"}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        i.status === "CONNECTED"
                          ? "var(--good)"
                          : i.status === "ERROR"
                            ? "var(--critical)"
                            : "var(--muted)",
                    }}
                  />
                  {i.status === "CONNECTED"
                    ? "Connected"
                    : i.status === "ERROR"
                      ? "Error"
                      : "Not connected"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {on && (
                    <button
                      type="button"
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-[11px]"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate(i.provider)}
                    >
                      Sync
                    </button>
                  )}
                  {on ? (
                    <>
                      {(i.isDemo || i.status === "ERROR") && (
                        <button
                          type="button"
                          className="rounded-control bg-accent px-2 py-1 text-[11px] font-medium text-white"
                          onClick={() => setModal(i)}
                        >
                          Reconnect
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-control border border-[var(--border)] px-2 py-1 text-[11px]"
                        disabled={disconnect.isPending}
                        onClick={() => disconnect.mutate(i.provider)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    i.comingSoon ? (
                      <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
                        Coming soon
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="rounded-control bg-accent px-2.5 py-1 text-[11px] font-medium text-white"
                        onClick={() => setModal(i)}
                      >
                        Connect
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <ConnectModal
          integration={modal}
          onClose={() => setModal(null)}
          onConnected={() => {
            setModal(null);
            onboarding?.markAction("integration");
            void qc.invalidateQueries({ queryKey: ["integrations"] });
            void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
            setToast(`Connected ${modal.name}`);
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function ConnectModal({
  integration,
  onClose,
  onConnected,
}: {
  integration: Integration;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/${integration.provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Connect failed");
      }
      if (data.oauthUrl) {
        window.location.href = data.oauthUrl as string;
        return;
      }
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  const isOauth = integration.auth === "oauth";

  async function oauthConnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/integrations/${integration.provider}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "oauth" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      if (data.oauthUrl) {
        window.location.href = data.oauthUrl as string;
        return;
      }
      throw new Error("No authorization URL returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-control text-base"
              style={{ background: integration.bg, color: "#fff" }}
            >
              {integration.icon}
            </div>
            <div>
              <h3 className="font-semibold">Connect {integration.name}</h3>
              <p className="text-xs text-muted">
                {isOauth ? "Authorize via OAuth" : "Enter credentials, encrypted at rest"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-sm text-muted hover:text-ink"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 px-5 py-4">
          {isOauth ? (
            <div className="space-y-2 text-sm text-ink-2">
              <p>
                You&apos;ll be redirected to {integration.name} to approve access. We store only
                encrypted tokens.
              </p>
              {!integration.oauthReady && (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
                  {integration.setupHint ??
                    "Add OAuth app credentials to your environment, then retry."}
                </p>
              )}
              {integration.docsUrl && (
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Provider docs →
                </a>
              )}
            </div>
          ) : (
            <>
              {integration.oauthOption && (
                <div className="space-y-2 rounded-control border border-[var(--border)] bg-surface-2/60 p-3">
                  <button
                    type="button"
                    disabled={busy || !integration.oauthReady}
                    className="w-full rounded-control bg-accent px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    onClick={() => void oauthConnect()}
                  >
                    {busy ? "Redirecting…" : `🔗 Connect with ${integration.name}`}
                  </button>
                  <p className="text-[11px] leading-snug text-muted">
                    {integration.oauthReady
                      ? `Recommended, you'll approve access on ${integration.name}. Works on every ${integration.name} plan, no API key needed.`
                      : (integration.setupHint ?? "One-click connect is not configured yet.")}
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-wide text-muted">
                    <span className="h-px flex-1 bg-[var(--border)]" /> or enter credentials
                    <span className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                </div>
              )}
              {integration.fields.map((f) => (
              <label key={f.key} className="block text-xs font-medium text-ink-2">
                {f.label}
                {f.required ? " *" : ""}
                <input
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm text-ink"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  autoComplete="off"
                />
                {f.help && <span className="mt-1 block text-[11px] text-muted">{f.help}</span>}
              </label>
              ))}
            </>
          )}

          {integration.provider === "twilio" && (
            <p className="text-[11px] leading-snug text-muted">
              US SMS requires A2P 10DLC registration with Twilio.{" "}
              <a
                href="https://www.twilio.com/docs/sms/a2p-10dlc"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                Checklist
              </a>
            </p>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (isOauth && !integration.oauthReady)}
              className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : isOauth
                  ? `Continue with ${integration.name}`
                  : "Save & verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
