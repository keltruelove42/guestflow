"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { useVertical } from "@/components/vertical-provider";
import { UpgradeChip } from "@/components/upgrade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { CAMPAIGN_STATUS_COLOR } from "@/lib/status";
import { CampaignWizard, type Campaign } from "./campaign-wizard";
import { FormPreviewModal } from "./form-preview-modal";

export default function CampaignsPage() {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const pack = useVertical();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const { toast, showToast } = useToast(5000);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => api<Campaign[]>("/api/v1/campaigns"),
    refetchInterval: 30_000,
  });

  const action = useMutation({
    mutationFn: ({ id, op }: { id: string; op: "launch" | "pause" | "resume" }) =>
      api(`/api/v1/campaigns/${id}/${op}`, {
        method: "POST",
        errorMessage: "Action failed",
      }),
    onSuccess: async (_d, vars) => {
      await qc.invalidateQueries({ queryKey: ["campaigns"] });
      if (vars.op === "launch") {
        onboarding?.markAction("campaign");
        void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
        showToast(
          "Campaign launched (demo). Leads from this form auto-enroll in your welcome sequence.",
        );
      }
    },
  });

  const sync = useMutation({
    mutationFn: () =>
      api("/api/v1/campaigns/sync-metrics", {
        method: "POST",
        errorMessage: "Sync failed",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const end = useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/campaigns/${id}`, {
        method: "DELETE",
        errorMessage: "Could not end campaign",
      }),
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
          <Button variant="ghost" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? "Syncing…" : "↻ Sync metrics"}
          </Button>
          <Button variant="primary" onClick={() => setWizardOpen(true)}>
            ＋ New campaign
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {!isLoading && campaigns.length === 0 && (
        <div className="rounded-card border border-[var(--border)] bg-surface p-8 text-center">
          <p className="text-sm text-ink-2">No campaigns yet.</p>
          <Button variant="primary" className="mt-3" onClick={() => setWizardOpen(true)}>
            Launch your first campaign
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {campaigns.map((c) => (
          <article
            key={c.id}
            className="rounded-card border border-[var(--border)] bg-surface p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="uppercase text-ink">{c.platform}</Badge>
              <Badge className="text-ink">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: CAMPAIGN_STATUS_COLOR[c.status] ?? "var(--muted)",
                  }}
                />
                {c.status.replace("_", " ")}
              </Badge>
              {c.isDemo && (
                <Badge className="bg-[color-mix(in_srgb,var(--warn)_25%,transparent)]">
                  Demo
                </Badge>
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
                <Button
                  variant="primary"
                  size="xs"
                  className="px-2.5 py-1.5"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "launch" })}
                >
                  Launch
                </Button>
              ) : c.status === "ACTIVE" ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="px-2.5 py-1.5"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "pause" })}
                >
                  Pause
                </Button>
              ) : c.status === "PAUSED" ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="px-2.5 py-1.5"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: c.id, op: "resume" })}
                >
                  Resume
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                className="px-2.5 py-1.5"
                onClick={() => setPreviewId(c.id)}
              >
                Lead form preview
              </Button>
              {c.status !== "ENDED" && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="px-2.5 py-1.5"
                  onClick={() => setEditTarget(c)}
                >
                  Edit
                </Button>
              )}
              {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                <Button
                  variant="danger"
                  size="xs"
                  className="px-2.5 py-1.5 font-normal"
                  disabled={end.isPending}
                  onClick={() => {
                    if (window.confirm(`End "${c.name}"? This can't be undone.`)) {
                      end.mutate(c.id);
                    }
                  }}
                >
                  End
                </Button>
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
            showToast(
              "Campaign launched (demo). In live mode this would submit to the platform Marketing API for review.",
            );
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
            showToast("Campaign updated.");
          }}
        />
      )}

      {previewId && (
        <FormPreviewModal campaignId={previewId} onClose={() => setPreviewId(null)} />
      )}

      <Toast message={toast} />
    </div>
  );
}
