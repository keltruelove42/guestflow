"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ParsedRow = {
  name: string;
  email: string | null;
  phone: string | null;
  travelDates: string | null;
  partySize: string | null;
  propertyName: string | null;
  notes: string | null;
  problem: string | null;
};

/** Minimal CSV parser: quoted fields, commas, CRLF. Tabs supported for paste. */
function parseDelimited(text: string): string[][] {
  const delimiter = text.includes("\t") && !text.trim().split("\n")[0]?.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedRow, "problem">> = {
  name: "name",
  "guest name": "name",
  "full name": "name",
  guest: "name",
  contact: "name",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  tel: "phone",
  telephone: "phone",
  dates: "travelDates",
  "travel dates": "travelDates",
  "check-in": "travelDates",
  checkin: "travelDates",
  stay: "travelDates",
  "party size": "partySize",
  party: "partySize",
  guests: "partySize",
  adults: "partySize",
  property: "propertyName",
  listing: "propertyName",
  unit: "propertyName",
  home: "propertyName",
  notes: "notes",
  note: "notes",
  message: "notes",
  inquiry: "notes",
  comments: "notes",
};

function mapRows(grid: string[][]): { rows: ParsedRow[]; headerFound: boolean } {
  const first = grid[0];
  if (!first) return { rows: [], headerFound: false };

  const header = first.map((h) => h.trim().toLowerCase());
  const mapping: Array<keyof Omit<ParsedRow, "problem"> | null> = header.map(
    (h) => HEADER_ALIASES[h] ?? null,
  );
  const headerFound = mapping.some((m) => m !== null);

  // No recognizable header: assume name,email,phone,dates order
  const dataRows = headerFound ? grid.slice(1) : grid;
  const fallback: Array<keyof Omit<ParsedRow, "problem">> = [
    "name",
    "email",
    "phone",
    "travelDates",
    "propertyName",
    "notes",
  ];

  const rows = dataRows.map((cells) => {
    const r: ParsedRow = {
      name: "",
      email: null,
      phone: null,
      travelDates: null,
      partySize: null,
      propertyName: null,
      notes: null,
      problem: null,
    };
    cells.forEach((cell, idx) => {
      const key = headerFound ? mapping[idx] : fallback[idx];
      if (!key) return;
      const v = cell.trim();
      if (!v) return;
      if (key === "name") r.name = v;
      else r[key] = v;
    });
    if (!r.name) r.problem = "Missing name";
    else if (!r.email && !r.phone) r.problem = "No email or phone";
    return r;
  });

  return { rows, headerFound };
}

const TEMPLATE = `name,email,phone,dates,property,notes
Jane Smith,jane@example.com,(305) 555-0100,Aug 12-16,Palm Cove Condo,Asked about parking
Mike & Ana Ruiz,mruiz@example.com,,Sep 3-8,,Repeat inquiry from last summer`;

export function ImportLeadsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const { rows, headerFound } = useMemo(() => mapRows(parseDelimited(raw)), [raw]);
  const valid = rows.filter((r) => !r.problem);
  const invalid = rows.filter((r) => r.problem);

  const importMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: valid.map(({ problem: _p, ...r }) => r),
          emailConsent: consent,
          smsConsent: consent,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Import failed");
      }
      return res.json() as Promise<{
        created: number;
        merged: number;
        errors: Array<{ row: number; reason: string }>;
      }>;
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads-count"] });
      setDone(
        `Imported ${r.created} new lead${r.created === 1 ? "" : "s"}` +
          (r.merged ? `, merged ${r.merged} with existing` : "") +
          (r.errors.length ? `, ${r.errors.length} skipped` : "") +
          ".",
      );
    },
  });

  async function onFile(file: File) {
    setRaw(await file.text());
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
    a.download = "guestflow-import-template.csv";
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="import-title"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-surface shadow-xl md:max-w-2xl md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 id="import-title" className="text-base font-semibold">
            Import past inquiries
          </h2>
          <button
            type="button"
            className="flex h-10 min-w-[44px] items-center justify-center rounded-control px-2 text-sm text-muted active:bg-surface-2"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
          {done ? (
            <div className="space-y-4">
              <div className="rounded-card border border-[var(--border)] bg-surface-2 p-4 text-sm">
                ✅ {done}
              </div>
              <p className="text-sm text-ink-2">
                Imported leads are tagged <b>IMPORT</b>. Open any of them to enroll them in a
                follow-up sequence.
              </p>
              <button
                type="button"
                className="w-full rounded-control bg-accent py-2.5 text-sm font-medium text-white"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                Upload a CSV or paste rows from a spreadsheet. Recognized columns:{" "}
                <b>name</b>, <b>email</b>, <b>phone</b>, dates, property, notes —{" "}
                <button type="button" className="text-accent underline" onClick={downloadTemplate}>
                  download template
                </button>
                .
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-4 py-2.5 text-sm"
                  onClick={() => fileRef.current?.click()}
                >
                  📄 Choose CSV file
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </div>

              <textarea
                className="min-h-[110px] w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 font-mono text-xs"
                placeholder={"name,email,phone,dates\nJane Smith,jane@example.com,,Aug 12-16"}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />

              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted">
                    {valid.length} ready to import
                    {invalid.length ? ` · ${invalid.length} skipped (missing name or contact)` : ""}
                    {!headerFound && " · no header row detected — assuming name, email, phone, dates order"}
                  </div>
                  <div className="max-h-48 overflow-auto rounded-card border border-[var(--border)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-2 text-muted">
                        <tr>
                          <th className="px-2 py-1.5 font-medium">Name</th>
                          <th className="px-2 py-1.5 font-medium">Contact</th>
                          <th className="hidden px-2 py-1.5 font-medium sm:table-cell">Dates</th>
                          <th className="px-2 py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 20).map((r, i) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="px-2 py-1.5">{r.name || "—"}</td>
                            <td className="max-w-[140px] truncate px-2 py-1.5">
                              {r.email ?? r.phone ?? "—"}
                            </td>
                            <td className="hidden px-2 py-1.5 sm:table-cell">
                              {r.travelDates ?? "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              {r.problem ? (
                                <span className="text-critical">{r.problem}</span>
                              ) : (
                                <span className="text-muted">ok</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 20 && (
                      <div className="px-2 py-1.5 text-center text-[11px] text-muted">
                        …and {rows.length - 20} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              <label className="flex items-start gap-2.5 rounded-control border border-[var(--border)] bg-surface-2 p-3 text-xs text-ink-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                These guests contacted me about a stay and I have permission to follow up with
                them by email/SMS. (Required — sets their contact consent.)
              </label>

              {importMut.error && (
                <p className="text-sm text-critical">
                  {importMut.error instanceof Error ? importMut.error.message : "Import failed"}
                </p>
              )}

              <button
                type="button"
                className="w-full rounded-control bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={valid.length === 0 || !consent || importMut.isPending}
                onClick={() => importMut.mutate()}
              >
                {importMut.isPending
                  ? "Importing…"
                  : `Import ${valid.length || ""} lead${valid.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
