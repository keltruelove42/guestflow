"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { Drawer } from "@/components/ui/modal";
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

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: () => api<LeadDetail>(`/api/v1/leads/${leadId}`, { errorMessage: "Failed" }),
  });

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
          </>
        )}
      </div>
    </Drawer>
  );
}
