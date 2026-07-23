"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVertical } from "@/components/vertical-provider";
import { useProperties } from "@/lib/queries";
import { AddPropertyModal } from "./add-property-modal";
import { AvailabilityCalendar } from "./availability-calendar";

type Property = {
  id: string;
  name: string;
  location: string | null;
  bedrooms: number | null;
  type: string;
  photoUrl: string | null;
  imageUrl: string | null;
  description: string | null;
  knowledgeBase: string | null;
  directBookingUrl: string | null;
  leadCount: number;
  activeCampaignCount: number;
  isDemo?: boolean;
};

export default function PropertiesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [calendarFor, setCalendarFor] = useState<Property | null>(null);

  const pack = useVertical();
  const { data, isLoading } = useProperties();
  const properties = (data ?? []) as Property[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          {`Scope campaigns, leads, and follow-ups to a ${pack.context.singular.toLowerCase()}.`} Open the calendar to see booked,
          blocked, and hold dates.
        </p>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          {`＋ Add ${pack.context.singular.toLowerCase()}`}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && properties.length === 0 && (
          <p className="text-sm text-muted col-span-full">
            {`No ${pack.context.plural.toLowerCase()} yet, add your first one to get started.`}
          </p>
        )}
        {properties.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-card border border-[var(--border)] bg-surface"
          >
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.name}
                className="h-36 w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="p-5">
              <div className="flex items-start gap-3">
                {!p.imageUrl && <div className="text-3xl">{p.photoUrl ?? "🏡"}</div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{p.name}</h2>
                    {p.isDemo && (
                      <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                        Demo
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {p.location ?? "-"}
                    {p.bedrooms != null ? ` · ${p.bedrooms} BR` : ""}
                  </p>
                </div>
              </div>
              {p.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted">{p.description}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="muted" size="md">
                  {p.type.replaceAll("_", "-").toLowerCase()}
                </Badge>
                <Badge tone="muted" size="md" className="tabular-nums">
                  {p.leadCount ?? 0} leads
                </Badge>
                <Badge tone="muted" size="md" className="tabular-nums">
                  {p.activeCampaignCount ?? 0} active ads
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => setCalendarFor(p)}
                >
                  📅 Calendar
                </button>
                <Link
                  href={`/leads?property=${p.id}`}
                  className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                >
                  View leads →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddPropertyModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["properties"] });
          }}
        />
      )}

      {calendarFor && (
        <AvailabilityCalendar
          property={calendarFor}
          onClose={() => setCalendarFor(null)}
        />
      )}
    </div>
  );
}
