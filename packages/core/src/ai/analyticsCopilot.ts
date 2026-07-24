import { analyticsCatalog, metricById } from "../analytics/catalog";
import { runReport, type ReportSpec, type ReportResult } from "../analytics/query";

/**
 * Analytics Copilot — turn a plain-English question ("which sequence booked the
 * most last month?") into a validated ReportSpec against the existing metrics
 * catalog, then run it. The model only ever picks from the catalog, so the
 * output always maps to a real, runnable report — no free-form SQL.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export function isCopilotConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type CopilotAnswer = {
  title: string;
  spec: ReportSpec;
  result: ReportResult;
  note?: string;
};

function buildPrompt(question: string): string {
  const cat = analyticsCatalog();
  const metricLines = cat.metrics
    .map((m) => `- ${m.id} (${m.label}, ${m.unit}) — group by: ${m.dimensions.join(", ")}`)
    .join("\n");
  const dimLines = cat.dimensions.map((d) => `- ${d.id} (${d.label}, ${d.kind})`).join("\n");

  return [
    "You translate a business owner's question into a chart specification. Choose ONLY from the metrics and dimensions below — never invent ids.",
    "",
    "METRICS (id — allowed groupBy dimensions):",
    metricLines,
    "",
    "DIMENSIONS:",
    dimLines,
    "",
    "Rules:",
    "- Pick the single best metric for the question.",
    "- groupBy MUST be one of that metric's allowed dimensions. Use 'time' for trends, a category (source/campaign/sequence/stage/property/platform) for breakdowns, 'none' for a single number.",
    "- If groupBy is 'time', set granularity to day, week, or month sensibly.",
    "- dateRange.preset ∈ 7d, 30d, 90d, 12mo, all. Map 'last month' → 30d, 'this year' → 12mo, etc.",
    "- chart ∈ line (time), bar (category), stat (single number), table.",
    "- Also write a short human title for the chart.",
    "",
    `Question: "${question}"`,
    "",
    'Respond with ONLY JSON: {"title": string, "spec": {"metric": string, "groupBy": string, "granularity"?: "day"|"week"|"month", "dateRange": {"preset": string}, "chart": string}}',
  ].join("\n");
}

/** Clamp the model's spec to something the engine will accept. */
function validateSpec(raw: unknown): { spec: ReportSpec; note?: string } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const metricId = String(obj.metric ?? "");
  const def = metricById(metricId);
  if (!def) throw new Error("Could not map that question to a known metric.");

  let groupBy = String(obj.groupBy ?? "");
  let note: string | undefined;
  if (!def.dimensions.includes(groupBy)) {
    groupBy = def.dimensions.includes("time") ? "time" : def.dimensions[0]!;
    note = `Grouped by ${groupBy} (the requested breakdown isn't available for this metric).`;
  }

  const granularity = (["day", "week", "month"].includes(String(obj.granularity))
    ? String(obj.granularity)
    : "day") as "day" | "week" | "month";

  const presetRaw = String(obj.preset ?? "30d");
  const preset = (["7d", "30d", "90d", "12mo", "all"].includes(presetRaw)
    ? presetRaw
    : "30d") as "7d" | "30d" | "90d" | "12mo" | "all";

  const chart = (["line", "bar", "stat", "table"].includes(String(obj.chart))
    ? String(obj.chart)
    : groupBy === "time"
      ? "line"
      : groupBy === "none"
        ? "stat"
        : "bar") as ReportSpec["chart"];

  const spec: ReportSpec = {
    metric: metricId,
    groupBy,
    ...(groupBy === "time" ? { granularity } : {}),
    dateRange: { preset },
    chart,
  };
  return { spec, note };
}

export async function answerAnalyticsQuestion(
  orgId: string,
  question: string,
): Promise<CopilotAnswer> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Analytics Copilot is not configured (ANTHROPIC_API_KEY).");
  const q = question.trim();
  if (!q) throw new Error("Ask a question about your data.");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: buildPrompt(q) }],
    }),
  });
  if (!res.ok) throw new Error(`Copilot request failed (${res.status})`);

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";

  const rawObj = safeParse(text);
  if (!rawObj || typeof rawObj !== "object") {
    throw new Error("Couldn't understand that question — try rephrasing.");
  }

  const specSource =
    (rawObj as { spec?: Record<string, unknown> }).spec ?? (rawObj as Record<string, unknown>);
  const flat = {
    metric: (specSource as Record<string, unknown>).metric,
    groupBy: (specSource as Record<string, unknown>).groupBy,
    granularity: (specSource as Record<string, unknown>).granularity,
    preset:
      ((specSource as Record<string, unknown>).dateRange as { preset?: string } | undefined)?.preset ??
      (specSource as Record<string, unknown>).preset,
    chart: (specSource as Record<string, unknown>).chart,
  };
  const { spec, note } = validateSpec(flat);
  const result = await runReport(orgId, spec);

  return {
    title: String((rawObj as { title?: string }).title ?? "Report"),
    spec,
    result,
    note,
  };
}

function safeParse(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const braced = text.match(/\{[\s\S]*\}/)?.[0];
  for (const c of [fenced, braced, text]) {
    if (!c) continue;
    try {
      return JSON.parse(c) as Record<string, unknown>;
    } catch {
      /* next */
    }
  }
  return null;
}
