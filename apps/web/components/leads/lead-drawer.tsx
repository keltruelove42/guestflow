"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { Drawer } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { DeliveryStatus } from "@/lib/queries";
import { ComposePanel } from "./compose-panel";
import { EnrollPanel } from "./enroll-panel";
import { LeadTimeline, PendingMessagesList } from "./lead-timeline";
import { canEmailLead, canSmsLead, type LeadDetail } from "./types";

/** Slide-over lead detail: contact snapshot, enroll, compose, pending, timeline. */
export function LeadDrawer({
  leadId,
  delivery,
  onClose,
  onSent,
}: {
  leadId: string;
  delivery?: DeliveryStatus;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api<LeadDetail>(`/api/v1/leads/${leadId}`, { errorMessage: "Failed" }),
  });

  const save = useMutation({
    mutationFn: (patch: { name: string; email: string | null; phone: string | null }) =>
      api(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        body: patch,
        errorMessage: "Update failed",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      setEditing(false);
      onSent("Lead updated.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed"),
  });

  const del = useMutation({
    mutationFn: () =>
      api(`/api/v1/leads/${leadId}`, { method: "DELETE", errorMessage: "Delete failed" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads-count"] });
      onSent("Lead deleted.");
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Delete failed"),
  });

  function startEdit() {
    if (!lead) return;
    setEditName(lead.name ?? "");
    setEditEmail(lead.email ?? "");
    setEditPhone(lead.phone ?? "");
    setError(null);
    setEditing(true);
  }

  const canEmail = canEmailLead(lead);
  const canSms = canSmsLead(lead);

  return (
    <Drawer onClose={onClose} widthClass="max-w-md">
      <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">{lead?.name ?? "Lead"}</h2>
          <p className="text-xs text-muted">
            {lead?.stage}
            {lead?.property?.name ? ` · ${lead.property.name}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="-mr-2 flex h-10 min-w-[44px] items-center justify-center rounded-control px-2 text-sm text-muted active:bg-surface-2"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto p-4 pb-[calc(20px+env(safe-area-inset-bottom))] md:p-5">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {lead && (
          <>
            {editing ? (
              <section className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-muted">Name</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] text-muted">Email</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted">Phone</label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="—"
                  />
                </div>
                {error && <p className="text-xs text-critical">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => {
                      if (!editName.trim()) return setError("Name can't be empty");
                      save.mutate({
                        name: editName.trim(),
                        email: editEmail.trim() || null,
                        phone: editPhone.trim() || null,
                      });
                    }}
                  >
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={save.isPending}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </section>
            ) : (
              <div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-control bg-surface-2 p-2">
                    <div className="text-muted">Email</div>
                    <div className="mt-0.5 font-medium text-ink">{lead.email ?? "-"}</div>
                    <div className="text-muted">
                      {canEmail ? "consent ok" : "cannot send"}
                    </div>
                  </div>
                  <div className="rounded-control bg-surface-2 p-2">
                    <div className="text-muted">Phone</div>
                    <div className="mt-0.5 font-medium text-ink">{lead.phone ?? "-"}</div>
                    <div className="text-muted">{canSms ? "consent ok" : "cannot send"}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-medium text-accent"
                  onClick={startEdit}
                >
                  Edit contact
                </button>
              </div>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Follow-up sequence</h3>
              <EnrollPanel
                leadId={leadId}
                enrollments={lead.enrollments}
                onError={setError}
                onEnrolled={onSent}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Compose</h3>
              <ComposePanel
                leadId={leadId}
                leadName={lead.name}
                propertyName={lead.property?.name ?? null}
                canEmail={canEmail}
                canSms={canSms}
                delivery={delivery}
                error={error}
                onError={setError}
                onSent={onSent}
                onSendSuccess={async () => {
                  onboarding?.markAction("message");
                  await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
                }}
              />
            </section>

            {lead.pendingMessages.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Pending</h3>
                <PendingMessagesList
                  items={lead.pendingMessages}
                  renderLabel={(m) =>
                    `${m.channel} · ${m.sequenceName} · ${new Date(m.sendAt).toLocaleString()}`
                  }
                />
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
              <LeadTimeline events={lead.events} />
            </section>

            <section className="border-t border-[var(--border)] pt-3">
              {confirmDelete ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-2">Delete this lead permanently?</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-critical"
                      disabled={del.isPending}
                      onClick={() => del.mutate()}
                    >
                      {del.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={del.isPending}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs font-medium text-critical"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete lead
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </Drawer>
  );
}
