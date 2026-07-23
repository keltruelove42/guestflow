"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type FormPreview = {
  propertyName: string;
  campaignName: string;
  fields: Array<{ key: string; label: string; required: boolean }>;
  consentCopy: string;
};

export function FormPreviewModal({
  campaignId,
  onClose,
}: {
  campaignId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["form-preview", campaignId],
    queryFn: () => api<FormPreview>(`/api/v1/campaigns/${campaignId}/form-preview`),
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
