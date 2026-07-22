"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdPlatform, type VerticalPack } from "@guestflow/shared";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { useVertical } from "@/components/vertical-provider";
import { UpgradeChip } from "@/components/upgrade";

type Campaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  dailyBudgetCents: number;
  spendCents: number;
  leadsCount: number;
  impressions: number;
  clicks: number;
  costPerLeadCents: number | null;
  audienceSummary: string;
  audience?: Record<string, unknown>;
  autoEnrollSequenceId?: string | null;
  leadForm: Array<{ key: string; label: string; required: boolean }>;
  isDemo: boolean;
  property: { id: string; name: string } | null;
};

type Property = { id: string; name: string };
type Sequence = { id: string; name: string; trigger: string };

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--good)",
  PAUSED: "var(--serious)",
  DRAFT: "var(--muted)",
  IN_REVIEW: "var(--warn)",
  ENDED: "var(--muted)",
};

const PLATFORMS = [
  {
    key: AdPlatform.META,
    name: "Meta",
    sub: "Instagram + Facebook instant forms",
    icon: "📘",
  },
  {
    key: AdPlatform.TIKTOK,
    name: "TikTok",
    sub: "TikTok Instant Form lead gen",
    icon: "🎵",
  },
  {
    key: AdPlatform.PINTEREST,
    name: "Pinterest",
    sub: "Pinterest lead ads",
    icon: "📌",
  },
] as const;

function fieldDefs(pack: VerticalPack) {
  return [
    { key: "name", label: "Full name", requiredLocked: true },
    { key: "email", label: "Email", requiredLocked: false },
    { key: "phone", label: "Phone", requiredLocked: false },
    { key: "address", label: "Address", requiredLocked: false },
    { key: "dates", label: pack.fields.timeframe, requiredLocked: false },
    { key: "party", label: pack.fields.detail, requiredLocked: false },
  ] as const;
}

const SMART = [
  { id: "abandoned", label: "Abandoned-inquiry lookalike (1%)", defaultOn: true },
  { id: "retarget", label: "Retarget site visitors · 30d", defaultOn: true },
  { id: "past", label: "Past-guest lookalike", defaultOn: false },
] as const;

export default function CampaignsPage() {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const pack = useVertical();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/v1/campaigns");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Campaign[]>;
    },
    refetchInterval: 30_000,
  });

  const action = useMutation({
    mutationFn: async ({
      id,
      op,
    }: {
      id: string;
      op: "launch" | "pause" | "resume";
    }) => {
      const res = await fetch(`/api/v1/campaigns/${id}/${op}`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Action failed");
      }
      return res.json();
    },
    onSuccess: async (_d, vars) => {
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      if (vars.op === "launch") {
        onboarding?.markAction("campaign");
        void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
        setToast(
          "Campaign launched (demo). Leads from this form auto-enroll in your welcome sequence.",
        );
        setTimeout(() => setToast(null), 5000);
      }
    },
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/campaigns/sync-metrics", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const end = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not end campaign");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Launch lead-generation ads with instant forms. People submit without leaving Instagram,
          Facebook, TikTok or Pinterest, and land in your CRM with a welcome sequence already
          running.{" "}
          <span className="whitespace-nowrap text-xs text-muted">
            Unlimited active campaigns <UpgradeChip />
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            {sync.isPending ? "Syncing…" : "↻ Sync metrics"}
          </button>
          <button
            type="button"
            className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={() => setWizardOpen(true)}
          >
            ＋ New campaign
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && campaigns.length === 0 && (
        <div className="rounded-card border border-[var(--border)] bg-surface p-8 text-center">
          <p className="text-sm text-ink-2">No campaigns yet.</p>
          <button
            type="button"
            className="mt-3 rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={() => setWizardOpen(true)}
          >
            Launch your first campaign
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {campaigns.map((c) => (
          <article
            key={c.id}
            className="rounded-card border border-[var(--border)] bg-surface p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] uppercase">
                {c.platform}
              </span>
              <span className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px]">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STATUS_COLOR[c.status] ?? "var(--muted)" }}
                />
                {c.status.replace("_", " ")}
              </span>
              {c.isDemo && (
                <span className="rounded-pill bg-[color-mix(in_srgb,var(--warn)_25%,transparent)] px-2 py-0.5 text-[11px] text-ink-2">
                  Demo
                </span>
              )}
            </div>
            <h2 className="mt-2 text-base font-semibold">{c.name}</h2>
            <p className="mt-1 text-xs text-ink-2">
              {c.property?.name ?? `All ${pack.context.plural.toLowerCase()}`} · $
              {(c.dailyBudgetCents / 100).toFixed(0)}/day
            </p>
            {c.audienceSummary && (
              <p className="mt-2 line-clamp-2 text-xs text-muted">{c.audienceSummary}</p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-control bg-surface-2 p-3 text-center">
              <div>
                <div className="text-sm font-semibold tabular-nums">
                  ${(c.spendCents / 100).toFixed(0)}
                </div>
                <div className="text-[10px] uppercase text-muted">Spend</div>
              </div>
              <div>
                <div className="text-sm font-semibold tabular-nums">{c.leadsCount}</div>
                <div className="text-[10px] uppercase text-muted">Leads</div>
              </div>
              <div>
                <div className="text-sm font-semibold tabular-nums">
                  {c.costPerLeadCents != null
                    ? `$${(c.costPerLeadCents / 100).toFixed(0)}`
                    : "-"}
                </div>
                <div className="text-[10px] uppercase text-muted">CPL</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status === "DRAFT" || c.status === "IN_REVIEW" ? (
                <button
                  type="button"
                  className="rounded-control bg-accent px-2.5 py-1.5 text-xs font-medium text-white"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "launch" })}
                >
                  Launch
                </button>
              ) : c.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "pause" })}
                >
                  Pause
                </button>
              ) : c.status === "PAUSED" ? (
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "resume" })}
                >
                  Resume
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                onClick={() => setPreviewId(c.id)}
              >
                Lead form preview
              </button>
              {c.status !== "ENDED" && (
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                  onClick={() => setEditTarget(c)}
                >
                  Edit
                </button>
              )}
              {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs text-critical"
                  disabled={end.isPending}
                  onClick={() => {
                    if (window.confirm(`End "${c.name}"? This can't be undone.`)) {
                      end.mutate(c.id);
                    }
                  }}
                >
                  End
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {wizardOpen && (
        <CampaignWizard
          pack={pack}
          onClose={() => setWizardOpen(false)}
          onLaunched={() => {
            setWizardOpen(false);
            onboarding?.markAction("campaign");
            qc.invalidateQueries({ queryKey: ["campaigns"] });
            qc.invalidateQueries({ queryKey: ["onboarding-status"] });
            setToast(
              "Campaign launched (demo). In live mode this would submit to the platform Marketing API for review.",
            );
            setTimeout(() => setToast(null), 5500);
          }}
        />
      )}

      {editTarget && (
        <CampaignWizard
          pack={pack}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onLaunched={() => {
            setEditTarget(null);
            qc.invalidateQueries({ queryKey: ["campaigns"] });
            setToast("Campaign updated.");
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}

      {previewId && (
        <FormPreviewModal campaignId={previewId} onClose={() => setPreviewId(null)} />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function CampaignWizard({
  pack,
  initial,
  onClose,
  onLaunched,
}: {
  pack: VerticalPack;
  initial?: Campaign;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const isEdit = Boolean(initial);
  const aud = (initial?.audience ?? {}) as Record<string, unknown>;
  const FIELD_DEFS = fieldDefs(pack);
  const INTERESTS = pack.adInterests;

  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState<string>(initial?.platform ?? AdPlatform.META);
  const [propertyId, setPropertyId] = useState(initial?.property?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [locations, setLocations] = useState(
    typeof aud.locations === "string" && aud.locations
      ? aud.locations
      : "Atlanta + Charlotte metro",
  );
  const [ageRange, setAgeRange] = useState(
    typeof aud.ageRange === "string" && aud.ageRange ? aud.ageRange : "28-55",
  );
  const [interests, setInterests] = useState<string[]>(
    Array.isArray(aud.interests) ? (aud.interests as string[]) : INTERESTS.slice(0, 2),
  );
  const [smart, setSmart] = useState<string[]>(
    Array.isArray(aud.smartAudiences)
      ? SMART.filter((s) => (aud.smartAudiences as string[]).includes(s.label)).map(
          (s) => s.id,
        )
      : SMART.filter((s) => s.defaultOn).map((s) => s.id),
  );
  const [budget, setBudget] = useState(
    initial ? Math.max(5, Math.round(initial.dailyBudgetCents / 100)) : 20,
  );
  const [schedule, setSchedule] = useState(
    typeof aud.schedule === "string" && aud.schedule ? aud.schedule : "continuous",
  );
  const [fields, setFields] = useState<Record<string, boolean>>(
    initial?.leadForm?.length
      ? Object.fromEntries(
          FIELD_DEFS.map((f) => [
            f.key,
            initial.leadForm.some((lf) => lf.key === f.key),
          ]),
        )
      : {
          name: true,
          email: true,
          phone: true,
          address: false,
          dates: true,
          party: false,
        },
  );
  const [sequenceId, setSequenceId] = useState(initial?.autoEnrollSequenceId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await fetch("/api/v1/properties");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Property[]>;
    },
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const res = await fetch("/api/v1/sequences");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Sequence[]>;
    },
  });

  const selectedPropertyId = propertyId || properties[0]?.id || "";
  const propertyName =
    properties.find((p) => p.id === selectedPropertyId)?.name ?? "Your property";

  const welcomeSeq =
    sequences.find((s) => s.trigger === "AD_LEAD_CAPTURED")?.id ?? sequences[0]?.id ?? "";
  const enrollSeqId = sequenceId || welcomeSeq;

  const estimates = useMemo(() => {
    const low = Math.round(budget / 3.2);
    const high = Math.round(budget / 1.9);
    const cplLow = (2.1 + budget * 0.04).toFixed(2);
    const cplHigh = (4.5 + budget * 0.06).toFixed(2);
    return { low, high, cplLow, cplHigh };
  }, [budget]);

  const platformName = PLATFORMS.find((p) => p.key === platform)?.name ?? platform;

  async function launch() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Campaign name is required");
      if (!selectedPropertyId) throw new Error(`Select a ${pack.context.singular.toLowerCase()}`);

      const leadForm = FIELD_DEFS.filter((f) => fields[f.key] || f.requiredLocked).map((f) => ({
        key: f.key,
        label: f.label + (f.key === "name" ? "" : " (optional)"),
        required: f.requiredLocked,
      }));

      const smartLabels = SMART.filter((s) => smart.includes(s.id)).map((s) => s.label);

      const payload = {
        platform,
        name: name.trim(),
        propertyId: selectedPropertyId,
        dailyBudgetCents: Math.round(budget * 100),
        audience: {
          locations,
          ageRange,
          interests,
          smartAudiences: smartLabels,
          schedule,
          summary: `${locations} · ${ageRange} · ${interests.join(", ") || "broad"}`,
        },
        leadForm,
        autoEnrollSequenceId: enrollSeqId || null,
      };

      if (isEdit) {
        const res = await fetch(`/api/v1/campaigns/${initial!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Could not update campaign");
        }
        onLaunched();
        return;
      }

      const createRes = await fetch("/api/v1/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        const d = await createRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not create campaign");
      }
      const created = await createRes.json();

      const launchRes = await fetch(`/api/v1/campaigns/${created.id}/launch`, {
        method: "POST",
      });
      if (!launchRes.ok) {
        const d = await launchRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not launch");
      }
      onLaunched();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {isEdit ? "Edit campaign" : "New lead campaign"} · step {step} of 4
            </h3>
            <button type="button" className="text-sm text-muted" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-pill"
                style={{
                  background: step >= i ? "var(--accent)" : "var(--surface-2)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="overflow-auto p-5 space-y-4">
          {step === 1 && (
            <>
              <h4 className="text-sm font-semibold">Where should this campaign run?</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={isEdit && initial?.status !== "DRAFT" && platform !== p.key}
                    onClick={() => {
                      if (isEdit && initial?.status !== "DRAFT") return;
                      setPlatform(p.key);
                    }}
                    className={`rounded-card border p-3 text-left ${
                      platform === p.key
                        ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                        : "border-[var(--border)] bg-page"
                    }`}
                  >
                    <div className="text-xl">{p.icon}</div>
                    <div className="mt-1 text-sm font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted">{p.sub}</div>
                  </button>
                ))}
              </div>
              <label className="block text-xs font-medium text-ink-2">
                {pack.context.singular} to promote
                <select
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={selectedPropertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-2">
                Campaign name
                <input
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  placeholder="e.g. Fall Weekend Getaways"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <h4 className="text-sm font-semibold">Who should see it?</h4>
              <label className="block text-xs font-medium text-ink-2">
                Locations
                <input
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-ink-2">
                Age range
                <input
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                />
              </label>
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-2">Interest targeting</div>
                <div className="flex flex-wrap gap-1.5">
                  {INTERESTS.map((t) => {
                    const on = interests.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`rounded-pill px-2.5 py-1 text-xs ${
                          on ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                        }`}
                        onClick={() =>
                          setInterests((prev) =>
                            on ? prev.filter((x) => x !== t) : [...prev, t],
                          )
                        }
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-ink-2">
                  Smart audiences (auto-built from your CRM)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SMART.map((s) => {
                    const on = smart.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`rounded-pill px-2.5 py-1 text-xs ${
                          on ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                        }`}
                        onClick={() =>
                          setSmart((prev) =>
                            on ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                          )
                        }
                      >
                        {on ? "✓ " : ""}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h4 className="text-sm font-semibold">Budget & schedule</h4>
              <label className="block text-xs font-medium text-ink-2">
                Daily budget ($)
                <input
                  type="number"
                  min={5}
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={budget}
                  onChange={(e) => setBudget(Math.max(5, Number(e.target.value) || 5))}
                />
              </label>
              <p className="text-xs text-ink-2">
                Estimated results at ${budget}/day on {platformName}:{" "}
                <b className="tabular-nums text-ink">
                  {estimates.low}-{estimates.high} leads/week
                </b>{" "}
                at a ${estimates.cplLow}-${estimates.cplHigh} cost per lead (estimate based on
                similar accounts).
              </p>
              <label className="block text-xs font-medium text-ink-2">
                Schedule
                <select
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                >
                  <option value="continuous">Run continuously</option>
                  <option value="end_date">Set end date later</option>
                </select>
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h4 className="text-sm font-semibold">Build the lead form</h4>
              <p className="text-xs text-muted">
                Everything except name is optional. Optional fields lift completion rates ~30%.
                Whatever they share is what the follow-up engine uses (email-first or SMS-first).
              </p>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_DEFS.map((f) => {
                  const on = fields[f.key] || f.requiredLocked;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      disabled={f.requiredLocked}
                      className={`rounded-pill px-2.5 py-1 text-xs ${
                        on ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                      } disabled:opacity-90`}
                      onClick={() => {
                        if (f.requiredLocked) return;
                        setFields((prev) => ({ ...prev, [f.key]: !prev[f.key] }));
                      }}
                    >
                      {f.label}
                      {f.requiredLocked ? " (required)" : ""}
                    </button>
                  );
                })}
              </div>

              <div className="mx-auto w-full max-w-xs rounded-[28px] border-2 border-[var(--border)] bg-page p-4 shadow-inner">
                <div className="mb-3 text-center text-sm font-semibold">
                  {propertyName} - get rates & availability
                </div>
                {FIELD_DEFS.filter((f) => fields[f.key] || f.requiredLocked).map((f) => (
                  <div
                    key={f.key}
                    className="mb-2 flex items-center justify-between rounded-control border border-[var(--border)] bg-surface px-3 py-2 text-xs"
                  >
                    <span>{f.label}</span>
                    <span
                      className="rounded-pill border px-1.5 py-0.5 text-[10px]"
                      style={
                        f.requiredLocked
                          ? { color: "var(--critical)", borderColor: "var(--critical)" }
                          : { color: "var(--muted)", borderColor: "var(--border)" }
                      }
                    >
                      {f.requiredLocked ? "required" : "optional"}
                    </span>
                  </div>
                ))}
                <div className="mt-3 rounded-control bg-accent py-2 text-center text-xs font-medium text-white">
                  Get availability →
                </div>
                <p className="mt-2 text-[10px] leading-snug text-muted">
                  By submitting, you agree to be contacted about this property by email or text.
                </p>
              </div>

              <label className="block text-xs font-medium text-ink-2">
                On submit, enroll in
                <select
                  className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={enrollSeqId}
                  onChange={(e) => setSequenceId(e.target.value)}
                >
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          {step > 1 && (
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
              onClick={() => setStep((s) => s - 1)}
            >
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button
              type="button"
              className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
              onClick={() => setStep((s) => s + 1)}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={launch}
            >
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Launching…"
                : isEdit
                  ? "Save changes"
                  : "Launch campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormPreviewModal({
  campaignId,
  onClose,
}: {
  campaignId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["form-preview", campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/form-preview`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        propertyName: string;
        campaignName: string;
        fields: Array<{ key: string; label: string; required: boolean }>;
        consentCopy: string;
      }>;
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-card border border-[var(--border)] bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Lead form preview</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {data && (
          <div className="rounded-[28px] border-2 border-[var(--border)] bg-page p-4">
            <div className="mb-1 text-center text-[11px] text-muted">{data.campaignName}</div>
            <div className="mb-3 text-center text-sm font-semibold">
              {data.propertyName} - get rates & availability
            </div>
            {data.fields.map((f) => (
              <div
                key={f.key}
                className="mb-2 flex items-center justify-between rounded-control border border-[var(--border)] bg-surface px-3 py-2 text-xs"
              >
                <span>{f.label.replace(" (optional)", "")}</span>
                <span className="text-[10px] text-muted">
                  {f.required ? "required" : "optional"}
                </span>
              </div>
            ))}
            <div className="mt-3 rounded-control bg-accent py-2 text-center text-xs font-medium text-white">
              Get availability →
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted">{data.consentCopy}</p>
          </div>
        )}
      </div>
    </div>
  );
}
