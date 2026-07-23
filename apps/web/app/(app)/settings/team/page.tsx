"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";

type TeamData = {
  users: Array<{ id: string; name: string | null; email: string; createdAt: string }>;
  invites: Array<{ id: string; email: string; token: string; expiresAt: string }>;
};

const QUERY_KEY = ["org-team"];

export default function TeamPage() {
  const qc = useQueryClient();
  const { toast, showToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api<TeamData>("/api/v1/org/invites", { errorMessage: "Failed to load team" }),
  });

  const invite = useMutation({
    mutationFn: (inviteEmail: string) =>
      api<{ id: string; email: string; link: string }>("/api/v1/org/invites", {
        method: "POST",
        body: { email: inviteEmail },
        errorMessage: "Invite failed",
      }),
    onSuccess: (d) => {
      setEmail("");
      setError(null);
      setInviteLink(d.link);
      showToast(`Invite sent to ${d.email}`);
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => {
      setInviteLink(null);
      setError(e instanceof ApiError ? e.message : "Invite failed");
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/v1/org/invites?id=${id}`, {
        method: "DELETE",
        errorMessage: "Could not revoke invite",
      }),
    onSuccess: () => {
      showToast("Invite revoked");
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not revoke invite"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || invite.isPending) return;
    invite.mutate(email.trim());
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Members</h2>
        <p className="mt-1 text-xs text-muted">
          Teammates share this workspace: same leads, sequences, and calendar.
        </p>
        {isLoading && <p className="mt-3 text-sm text-muted">Loading…</p>}
        <div className="mt-3 space-y-1.5">
          {(data?.users ?? []).map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-control bg-surface-2 px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium">{u.name ?? u.email}</span>
                {u.name && <span className="ml-2 text-xs text-muted">{u.email}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted">
                Joined{" "}
                {new Date(u.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          ))}
          {!isLoading && (data?.users ?? []).length === 0 && (
            <p className="text-sm text-muted">No members yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Pending invites</h2>
        <div className="mt-3 space-y-1.5">
          {(data?.invites ?? []).map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-3 rounded-control border border-dashed border-[var(--border)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-ink-2">
                {i.email}
                <span className="ml-2 rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                  invited
                </span>
              </span>
              <Button
                variant="link"
                size="xs"
                className="shrink-0 text-critical"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(i.id)}
              >
                Revoke
              </Button>
            </div>
          ))}
          {!isLoading && (data?.invites ?? []).length === 0 && (
            <p className="text-sm text-muted">No pending invites.</p>
          )}
        </div>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <Input
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Teammate email"
          />
          <Button
            type="submit"
            variant="primary"
            className="shrink-0"
            disabled={invite.isPending || !email.trim()}
          >
            {invite.isPending ? "Inviting…" : "Send invite"}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-critical">{error}</p>}
        {inviteLink && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <code className="truncate rounded bg-surface-2 px-2 py-1">{inviteLink}</code>
            <button
              type="button"
              className="shrink-0 text-accent"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                showToast("Link copied");
              }}
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
