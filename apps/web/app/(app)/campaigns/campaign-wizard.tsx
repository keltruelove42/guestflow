"use client";

import { useMemo, useState } from "react";
import { AdPlatform, type VerticalPack } from "@guestflow/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { useProperties, useSequences } from "@/lib/queries";

export type Campaign = {
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

export function CampaignWizard({
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

  const { data: properties = [] } = useProperties();
  const { data: sequences = [] } = useSequences();

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
        await api(`/api/v1/campaigns/${initial!.id}`, {
          method: "PATCH",
          body: payload,
          errorMessage: "Could not update campaign",
        });
        onLaunched();
        return;
      }

      const created = await api<{ id: string }>("/api/v1/campaigns", {
        method: "POST",
        body: payload,
        errorMessage: "Could not create campaign",
      });

      await api(`/api/v1/campaigns/${created.id}/launch`, {
        method: "POST",
        errorMessage: "Could not launch",
      });
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
              <Field label={`${pack.context.singular} to promote`}>
                <Select
                  value={selectedPropertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Campaign name">
                <Input
                  placeholder="e.g. Fall Weekend Getaways"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h4 className="text-sm font-semibold">Who should see it?</h4>
              <Field label="Locations">
                <Input value={locations} onChange={(e) => setLocations(e.target.value)} />
              </Field>
              <Field label="Age range">
                <Input value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
              </Field>
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
              <Field label="Daily budget ($)">
                <Input
                  type="number"
                  min={5}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(5, Number(e.target.value) || 5))}
                />
              </Field>
              <p className="text-xs text-ink-2">
                Estimated results at ${budget}/day on {platformName}:{" "}
                <b className="tabular-nums text-ink">
                  {estimates.low}-{estimates.high} leads/week
                </b>{" "}
                at a ${estimates.cplLow}-${estimates.cplHigh} cost per lead (estimate based on
                similar accounts).
              </p>
              <Field label="Schedule">
                <Select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                  <option value="continuous">Run continuously</option>
                  <option value="end_date">Set end date later</option>
                </Select>
              </Field>
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

              <Field label="On submit, enroll in">
                <Select value={enrollSeqId} onChange={(e) => setSequenceId(e.target.value)}>
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
          )}
          {step < 4 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Continue →
            </Button>
          ) : (
            <Button variant="primary" disabled={saving} onClick={launch}>
              {saving
                ? isEdit
                  ? "Saving…"
                  : "Launching…"
                : isEdit
                  ? "Save changes"
                  : "Launch campaign"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
