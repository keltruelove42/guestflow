"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UpgradeChip } from "@/components/upgrade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { useOrgVariables } from "@/lib/queries";

const BUILTIN_AUTO: Array<{ tag: string; desc: string }> = [
  { tag: "first_name", desc: "Lead's first name" },
  { tag: "name", desc: "Lead's full name" },
  { tag: "property", desc: "The offering the lead asked about" },
  { tag: "dates", desc: "Lead's timeframe" },
  { tag: "quote_link", desc: "Best booking / quote link for this lead" },
  { tag: "unsub_link", desc: "Unsubscribe link (auto-added to emails)" },
  { tag: "season", desc: "Current season (spring, summer, fall, winter)" },
];

const BUILTIN_EDITABLE: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "host_name", label: "Your name (signature)", placeholder: "e.g. Taylor" },
  { key: "business_name", label: "Business name", placeholder: "e.g. Coda Motors" },
  { key: "booking_link", label: "Default booking link", placeholder: "https://…" },
];

export function VariablesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [builtins, setBuiltins] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data } = useOrgVariables();

  useEffect(() => {
    if (!data || loaded) return;
    const vars = { ...data.variables };
    const b: Record<string, string> = {};
    for (const def of BUILTIN_EDITABLE) {
      if (vars[def.key]) {
        b[def.key] = vars[def.key]!;
        delete vars[def.key];
      }
    }
    setBuiltins(b);
    setRows(Object.entries(vars).map(([key, value]) => ({ key, value })));
    setLoaded(true);
  }, [data, loaded]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const variables: Record<string, string> = {};
      for (const def of BUILTIN_EDITABLE) {
        const v = (builtins[def.key] ?? "").trim();
        if (v) variables[def.key] = v;
      }
      for (const row of rows) {
        const key = row.key.trim().toLowerCase().replace(/\s+/g, "_");
        if (!key) continue;
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
          throw new Error(
            `"${row.key}" is not a valid variable name. Use letters, numbers and underscores, starting with a letter.`,
          );
        }
        if (!row.value.trim()) continue;
        variables[key] = row.value.trim();
      }
      await api("/api/v1/org/variables", {
        method: "PUT",
        body: { variables },
        errorMessage: "Save failed",
      });
      await qc.invalidateQueries({ queryKey: ["org-variables"] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Message variables" size="md" onClose={onClose}>
      <div className="space-y-5 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Your business
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Used anywhere you write the matching {"{{tag}}"} in a message.
          </p>
          <div className="mt-3 space-y-2">
            {BUILTIN_EDITABLE.map((def) => (
              <div key={def.key} className="flex items-center gap-2">
                <code className="w-40 shrink-0 rounded-control bg-surface-2 px-2 py-1.5 text-[11px]">
                  {`{{${def.key}}}`}
                </code>
                <Input
                  className="py-1.5"
                  placeholder={def.placeholder}
                  value={builtins[def.key] ?? ""}
                  onChange={(e) =>
                    setBuiltins((b) => ({ ...b, [def.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Custom variables
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Create your own, like discount_code or showroom_address, then use{" "}
            {"{{discount_code}}"} in any step.{" "}
            <span className="whitespace-nowrap">
              Unlimited custom variables <UpgradeChip />
            </span>
          </p>
          <div className="mt-3 space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="w-40 shrink-0 px-2 py-1.5 font-mono text-[11px]"
                  placeholder="variable_name"
                  value={row.key}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, key: e.target.value };
                    setRows(next);
                  }}
                />
                <Input
                  className="py-1.5"
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, value: e.target.value };
                    setRows(next);
                  }}
                />
                <button
                  type="button"
                  className="shrink-0 text-xs text-critical"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              variant="link"
              onClick={() => setRows([...rows, { key: "", value: "" }])}
            >
              ＋ Add variable
            </Button>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Filled automatically per lead
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BUILTIN_AUTO.map((b) => (
              <Badge key={b.tag} tone="neutral" size="xs" title={b.desc} className="py-1 font-mono">
                {`{{${b.tag}}}`}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            A variable with no value renders as blank, so a missing tag never sends a
            broken message.
          </p>
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save variables"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
