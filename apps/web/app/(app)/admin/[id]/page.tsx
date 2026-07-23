"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";

type OrgDetail = {
  org: {
    id: string;
    name: string;
    plan: string;
    mode: string;
    vertical: string;
    trialEndsAt: string | null;
    createdAt: string;
    users: {
      id: string;
      name: string | null;
      email: string;
      role: string;
      createdAt: string;
    }[];
  };
  trial: {
    onTrial: boolean;
    endsAt: string | null;
    expired: boolean;
    daysLeft: number;
    emails: { used: number; limit: number; remaining: number };
    sms: { used: number; limit: number; remaining: number };
  };
  recentEvents: {
    id: string;
    type: string;
    channel: string | null;
    title: string;
    occurredAt: string;
    lead: { id: string; name: string; stage: string } | null;
  }[];
};

const PLANS = ["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"] as const;

const PLAN_TONE: Record<string, BadgeTone> = {
  TRIAL: "muted",
  STARTER: "neutral",
  GROWTH: "accent",
  ENTERPRISE: "good",
};

function eventEmoji(type: string): string {
  switch (type) {
    case "EMAIL_SENT":
      return "✉️";
    case "SMS_SENT":
      return "💬";
    case "EMAIL_OPENED":
      return "👁️";
    case "REPLIED":
      return "↩️";
    case "BOOKED":
      return "✅";
    case "CODE_REDEEMED":
      return "🎟️";
    default:
      return "•";
  }
}

function CreditBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-2">{label}</span>
        <span className="tabular-nums text-muted">
          {used} / {limit}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-surface-2">
        <div
          className="h-full rounded-pill bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminOrgDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast, showToast } = useToast();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-org", id],
    queryFn: () => api<OrgDetail>(`/api/v1/admin/orgs/${id}`),
  });

  const extendTrial = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; trialEndsAt: string }>(`/api/v1/admin/orgs/${id}`, {
        method: "PATCH",
        body: { action: "extendTrial", days: 7 },
        errorMessage: "Could not extend trial",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-org", id] });
      await qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      showToast("Trial extended by 7 days");
    },
    onError: (e) => showToast((e as ApiError).message),
  });

  const setPlan = useMutation({
    mutationFn: (plan: string) =>
      api<{ ok: boolean; plan: string }>(`/api/v1/admin/orgs/${id}`, {
        method: "PATCH",
        body: { action: "setPlan", plan },
        errorMessage: "Could not update plan",
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["admin-org", id] });
      await qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      showToast(`Plan set to ${res.plan}`);
    },
    onError: (e) => showToast((e as ApiError).message),
  });

  const deleteOrg = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(`/api/v1/admin/orgs/${id}`, {
        method: "DELETE",
        errorMessage: "Could not delete workspace",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-orgs"] });
      showToast("Workspace deleted");
      router.push("/admin");
    },
    onError: (e) => {
      setConfirmDelete(false);
      showToast((e as ApiError).message);
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted">Loading workspace…</div>;
  }
  if (error || !data) {
    return (
      <div className="rounded-card border border-[var(--border)] bg-surface p-6 text-sm text-critical">
        {error ? (error as Error).message : "Workspace not found"}
      </div>
    );
  }

  const { org, trial, recentEvents } = data;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin" className="text-sm text-accent">
          ← All workspaces
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">{org.name}</h2>
        <Badge tone={PLAN_TONE[org.plan] ?? "neutral"}>{org.plan}</Badge>
        <span className="text-sm text-ink-2">{org.mode}</span>
        <span className="text-sm text-muted">
          Created{" "}
          {new Date(org.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Trial card */}
      <div className="rounded-card border border-[var(--border)] bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Trial &amp; credits</h3>
          {trial.expired ? (
            <span className="text-sm font-medium text-critical">
              Trial expired
            </span>
          ) : trial.onTrial ? (
            <span className="text-sm text-ink-2">
              <span className="font-medium text-ink tabular-nums">
                {trial.daysLeft}
              </span>{" "}
              days left
            </span>
          ) : (
            <span className="text-sm text-muted">Not on trial</span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CreditBar
            label="Emails"
            used={trial.emails.used}
            limit={trial.emails.limit}
          />
          <CreditBar label="SMS" used={trial.sms.used} limit={trial.sms.limit} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-end gap-3 rounded-card border border-[var(--border)] bg-surface p-4">
        <Button
          variant="secondary"
          onClick={() => extendTrial.mutate()}
          disabled={extendTrial.isPending}
        >
          {extendTrial.isPending ? "Extending…" : "Extend trial +7 days"}
        </Button>

        <Field label="Plan" className="w-40">
          <Select
            value={org.plan}
            disabled={setPlan.isPending}
            onChange={(e) => setPlan.mutate(e.target.value)}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Button
          variant="danger"
          className="ml-auto"
          onClick={() => {
            setConfirmName("");
            setConfirmDelete(true);
          }}
        >
          Delete workspace
        </Button>
      </div>

      {/* Members */}
      <div className="rounded-card border border-[var(--border)] bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">
          Members{" "}
          <span className="font-normal text-muted">({org.users.length})</span>
        </h3>
        <div className="divide-y divide-[var(--border)]">
          {org.users.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-ink">{u.name ?? u.email}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="neutral">{u.role}</Badge>
                <span className="text-xs text-muted">
                  Joined {relativeTime(u.createdAt)}
                </span>
              </div>
            </div>
          ))}
          {org.users.length === 0 && (
            <div className="py-2 text-sm text-muted">No members.</div>
          )}
        </div>
      </div>

      {/* Recent events */}
      <div className="rounded-card border border-[var(--border)] bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">What leads are doing</h3>
        <div className="space-y-2">
          {recentEvents.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 text-sm">
              <span className="w-5 shrink-0 text-center">
                {eventEmoji(ev.type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-ink-2">{ev.title}</div>
                {ev.lead && (
                  <div className="text-xs text-muted">
                    {ev.lead.name} · {ev.lead.stage}
                  </div>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted">
                {relativeTime(ev.occurredAt)}
              </span>
            </div>
          ))}
          {recentEvents.length === 0 && (
            <div className="text-sm text-muted">No recent activity.</div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete workspace"
          size="sm"
          onClose={() => setConfirmDelete(false)}
        >
          <div className="space-y-4 p-5">
            <p className="text-sm text-ink-2">
              This permanently deletes{" "}
              <span className="font-medium text-ink">{org.name}</span> and all of
              its data. This cannot be undone.
            </p>
            <Field
              label={
                <>
                  Type <span className="font-semibold">{org.name}</span> to
                  confirm
                </>
              }
            >
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={org.name}
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={confirmName !== org.name || deleteOrg.isPending}
                onClick={() => deleteOrg.mutate()}
              >
                {deleteOrg.isPending ? "Deleting…" : "Delete workspace"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Toast message={toast} />
    </div>
  );
}
