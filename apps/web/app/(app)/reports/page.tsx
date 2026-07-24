"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Toast, useToast } from "@/components/ui/toast";
import { UpgradeChip, usePlan } from "@/components/upgrade";
import { ReportBuilder } from "@/components/reports/report-builder";
import { ReportChart } from "@/components/reports/report-chart";
import type {
  Catalog,
  ReportSpec,
  RunResult,
  SavedReport,
} from "@/components/reports/types";

/* ------------------------------- starter reports ------------------------------- */

const STARTERS: { name: string; spec: ReportSpec }[] = [
  {
    name: "New leads (daily)",
    spec: {
      metric: "new_leads",
      groupBy: "time",
      granularity: "day",
      dateRange: { preset: "30d" },
      chart: "line",
    },
  },
  {
    name: "Booking revenue by campaign",
    spec: {
      metric: "booking_revenue",
      groupBy: "campaign",
      dateRange: { preset: "90d" },
      chart: "bar",
    },
  },
  {
    name: "Open rate (weekly)",
    spec: {
      metric: "open_rate",
      groupBy: "time",
      granularity: "week",
      dateRange: { preset: "90d" },
      chart: "line",
    },
  },
];

/* ------------------------------- analytics copilot ----------------------------- */

type CopilotAnswer = {
  title: string;
  spec: ReportSpec;
  result: RunResult;
  note?: string;
};

const ASK_EXAMPLES = [
  "New leads by week",
  "Booking revenue by campaign",
  "Open rate over time",
];

function AskPanel({ showToast }: { showToast: (message: string) => void }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<CopilotAnswer | null>(null);

  const ask = useMutation({
    mutationFn: (q: string) =>
      api<CopilotAnswer>("/api/v1/analytics/ask", {
        method: "POST",
        body: { question: q },
        errorMessage: "Couldn’t understand that question — try rephrasing.",
      }),
    onSuccess: (data) => setAnswer(data),
    onError: (e) =>
      showToast(
        e instanceof ApiError
          ? e.message
          : "Couldn’t understand that question — try rephrasing.",
      ),
  });

  const save = useMutation({
    mutationFn: (a: CopilotAnswer) =>
      api<SavedReport>("/api/v1/analytics/reports", {
        method: "POST",
        body: { name: a.title, spec: a.spec },
        errorMessage: "Could not save report",
      }),
    onSuccess: (_data, a) => {
      showToast(`Saved “${a.title}”`);
      qc.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
    onError: (e) =>
      showToast(e instanceof ApiError ? e.message : "Could not save report"),
  });

  function submit() {
    const q = question.trim();
    if (!q || ask.isPending) return;
    ask.mutate(q);
  }

  return (
    <section className="rounded-card border border-[var(--border)] bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-base">✨</span>
        <h2 className="text-sm font-semibold">Ask about your data</h2>
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          className="min-w-0 flex-1"
          value={question}
          placeholder="Ask about your data — e.g. which sequence booked the most last month?"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          variant="primary"
          className="shrink-0"
          disabled={!question.trim() || ask.isPending}
          onClick={submit}
        >
          {ask.isPending ? "Thinking…" : "Ask"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Try:</span>
        {ASK_EXAMPLES.map((ex) => (
          <Button
            key={ex}
            variant="ghost"
            size="xs"
            onClick={() => setQuestion(ex)}
          >
            {ex}
          </Button>
        ))}
      </div>

      {ask.isPending && <p className="mt-3 text-sm text-muted">Thinking…</p>}

      {answer && !ask.isPending && (
        <div className="mt-4 rounded-card border border-[var(--border)] bg-page p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold">
              {answer.title}
            </h3>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="secondary"
                size="xs"
                disabled={save.isPending}
                onClick={() => save.mutate(answer)}
              >
                {save.isPending ? "Saving…" : "Save to dashboard"}
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setAnswer(null)}>
                Clear
              </Button>
            </div>
          </div>

          <ReportChart
            result={answer.result}
            chart={answer.spec.chart ?? "line"}
            granularity={
              answer.spec.groupBy === "time"
                ? answer.spec.granularity
                : undefined
            }
            height={200}
          />

          {answer.note && (
            <p className="mt-3 text-xs text-muted">{answer.note}</p>
          )}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- page entry ---------------------------------- */

export default function ReportsPage() {
  const { hasGrowth } = usePlan();
  if (!hasGrowth) return <LockedTeaser />;
  return <ReportsDashboard />;
}

/* --------------------------------- locked view --------------------------------- */

function LockedTeaser() {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-card border border-[var(--border)] bg-surface p-8 text-center">
      <div className="text-4xl">📊</div>
      <h2 className="mt-3 flex items-center justify-center gap-2 text-lg font-semibold">
        Custom reports <UpgradeChip />
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">
        Build any chart from your leads, messaging, bookings and ad spend.
      </p>
      <Link href="/settings/billing" className="mt-5 inline-block">
        <Button variant="primary" size="lg">
          Upgrade to Growth
        </Button>
      </Link>
    </div>
  );
}

/* --------------------------------- dashboard ----------------------------------- */

function ReportsDashboard() {
  const qc = useQueryClient();
  const { toast, showToast } = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<SavedReport | null>(null);

  const catalogQ = useQuery({
    queryKey: ["analytics-catalog"],
    queryFn: () =>
      api<Catalog>("/api/v1/analytics/catalog", {
        errorMessage: "Could not load report catalog",
      }),
    staleTime: 10 * 60_000,
  });

  const reportsQ = useQuery({
    queryKey: ["analytics-reports"],
    queryFn: () =>
      api<SavedReport[]>("/api/v1/analytics/reports", {
        errorMessage: "Could not load reports",
      }),
  });

  const addStarter = useMutation({
    mutationFn: (starter: { name: string; spec: ReportSpec }) =>
      api<SavedReport>("/api/v1/analytics/reports", {
        method: "POST",
        body: starter,
        errorMessage: "Could not add report",
      }),
    onSuccess: (_data, starter) => {
      showToast(`Added “${starter.name}”`);
      qc.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
    onError: (e) =>
      showToast(e instanceof ApiError ? e.message : "Could not add report"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/api/v1/analytics/reports/${id}`, {
        method: "DELETE",
        errorMessage: "Could not delete report",
      }),
    onSuccess: () => {
      showToast("Report deleted");
      qc.invalidateQueries({ queryKey: ["analytics-reports"] });
    },
    onError: (e) =>
      showToast(e instanceof ApiError ? e.message : "Could not delete report"),
  });

  const catalog = catalogQ.data;
  const reports = reportsQ.data ?? [];

  function openNew() {
    setEditing(null);
    setBuilderOpen(true);
  }
  function openEdit(r: SavedReport) {
    setEditing(r);
    setBuilderOpen(true);
  }
  function closeBuilder() {
    setBuilderOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-sm text-ink-2">
            Build any chart from your leads, messaging, bookings and ad spend.
          </p>
        </div>
        <Button variant="primary" onClick={openNew} disabled={!catalog}>
          ＋ New report
        </Button>
      </div>

      {/* Analytics copilot — ask in plain language */}
      <AskPanel showToast={showToast} />

      {/* Quick-add starters */}
      {catalog && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Quick add:</span>
          {STARTERS.map((s) => (
            <Button
              key={s.name}
              variant="ghost"
              size="xs"
              onClick={() => addStarter.mutate(s)}
              disabled={addStarter.isPending}
            >
              ＋ {s.name}
            </Button>
          ))}
        </div>
      )}

      {catalogQ.isLoading && (
        <p className="text-sm text-muted">Loading report catalog…</p>
      )}
      {catalogQ.isError && (
        <p className="text-sm text-critical">
          {catalogQ.error instanceof ApiError
            ? catalogQ.error.message
            : "Could not load report catalog"}
        </p>
      )}

      {/* Empty state */}
      {catalog && !reportsQ.isLoading && reports.length === 0 && (
        <div className="rounded-card border border-dashed border-[var(--border)] bg-surface p-8 text-center">
          <div className="text-3xl">📈</div>
          <h3 className="mt-2 font-semibold">No reports yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Create your first report, or add one of the starters above to get
            going.
          </p>
          <Button variant="primary" className="mt-4" onClick={openNew}>
            ＋ New report
          </Button>
        </div>
      )}

      {/* Saved reports grid */}
      {catalog && reports.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              catalog={catalog}
              onEdit={() => openEdit(r)}
              onDelete={() => {
                if (
                  confirm(`Delete “${r.name}”? This can’t be undone.`)
                )
                  remove.mutate(r.id);
              }}
            />
          ))}
        </div>
      )}

      {builderOpen && catalog && (
        <Modal
          title={editing ? "Edit report" : "New report"}
          size="xl"
          onClose={closeBuilder}
        >
          <ReportBuilder
            catalog={catalog}
            initial={editing}
            onClose={closeBuilder}
            onSaved={() =>
              qc.invalidateQueries({ queryKey: ["analytics-reports"] })
            }
          />
        </Modal>
      )}

      <Toast message={toast} />
    </div>
  );
}

/* ---------------------------------- report card -------------------------------- */

function ReportCard({
  report,
  catalog,
  onEdit,
  onDelete,
}: {
  report: SavedReport;
  catalog: Catalog;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const runQ = useQuery({
    queryKey: ["analytics-run", report.id, report.spec],
    queryFn: () =>
      api<RunResult>("/api/v1/analytics/run", {
        method: "POST",
        body: report.spec,
        errorMessage: "Could not run report",
      }),
  });

  const chart = report.spec.chart ?? "line";
  const rangeLabel = catalog.datePresets.find(
    (p) => p.id === report.spec.dateRange?.preset,
  )?.label;

  return (
    <div className="flex flex-col rounded-card border border-[var(--border)] bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{report.name}</h3>
          {rangeLabel && (
            <div className="text-xs text-muted">{rangeLabel}</div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-control px-2 py-1 text-xs text-ink-2 hover:bg-surface-2"
            title="Edit report"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-control px-2 py-1 text-xs text-critical hover:bg-surface-2"
            title="Delete report"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="min-h-[140px] flex-1">
        {runQ.isLoading ? (
          <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted">
            Loading…
          </div>
        ) : runQ.isError ? (
          <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-critical">
            {runQ.error instanceof ApiError
              ? runQ.error.message
              : "Could not run report"}
          </div>
        ) : (
          <ReportChart
            result={runQ.data}
            chart={chart}
            granularity={
              report.spec.groupBy === "time"
                ? report.spec.granularity
                : undefined
            }
            rangeLabel={rangeLabel}
            height={180}
          />
        )}
      </div>
    </div>
  );
}
