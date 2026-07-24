"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useVertical } from "@/components/vertical-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSequences, type Sequence } from "@/lib/queries";
import { SequenceCard } from "./sequence-card";
import { SequenceEditor } from "./sequence-editor";
import { VariablesModal } from "./variables-modal";
import { Icon, type IconName } from "@/components/ui/icons";

/** Folder definitions: one per follow-up type, in display order. */
const FOLDERS: Array<{ trigger: string; icon: IconName; title: string }> = [
  { trigger: "AD_LEAD_CAPTURED", icon: "zap", title: "New lead response" },
  { trigger: "INQUIRY_ABANDONED", icon: "inbox", title: "Abandoned inquiry rescue" },
  { trigger: "QUOTE_UNACCEPTED_48H", icon: "message", title: "Quote & offer follow-up" },
  { trigger: "CHECKOUT_PLUS_90D", icon: "repeat", title: "Rebook & win-back" },
  { trigger: "MANUAL_ONLY", icon: "userCheck", title: "Manual plays" },
];

export default function SequencesPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<null | { mode: "create" | "edit"; seq?: Sequence }>(
    null,
  );
  const [varsOpen, setVarsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pack = useVertical();
  const { data: sequences = [], isLoading } = useSequences();

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => {
      const path = active ? "activate" : "pause";
      return api(`/api/v1/sequences/${id}/${path}`, {
        method: "POST",
        errorMessage: "Failed",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const byTrigger = useMemo(() => {
    const map = new Map<string, Sequence[]>();
    for (const f of FOLDERS) map.set(f.trigger, []);
    for (const s of sequences) {
      const bucket = map.get(s.trigger);
      if (bucket) bucket.push(s);
      else map.set(s.trigger, [s]);
    }
    // Own sequences first inside each folder, then templates
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.isDemo ?? false) - Number(b.isDemo ?? false));
    }
    return map;
  }, [sequences]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-ink-2">
          {pack.copy.followupsDesc} Demo mode logs sends instead of delivering.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setVarsOpen(true)}>
            {"{ } Variables"}
          </Button>
          <Button variant="primary" onClick={() => setEditor({ mode: "create" })}>
            ＋ New sequence
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      {!isLoading &&
        FOLDERS.map((folder) => {
          const list = byTrigger.get(folder.trigger) ?? [];
          if (list.length === 0) return null;
          const activeCount = list.filter((s) => s.active).length;
          return (
            <details
              key={folder.trigger}
              open
              className="rounded-card border border-[var(--border)] bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-accent"><Icon name={folder.icon} size={15} /></span>
                <span className="text-sm font-semibold">{folder.title}</span>
                <Badge tone="muted" size="sm">
                  {list.length}
                </Badge>
                <span className="hidden text-xs text-muted sm:inline">
                  {pack.triggerLabels[folder.trigger] ?? ""}
                </span>
                <span className="ml-auto text-[11px] text-muted">
                  {activeCount} active
                </span>
              </summary>
              <div className="grid gap-3 border-t border-[var(--border)] p-4 lg:grid-cols-2">
                {list.map((s) => (
                  <SequenceCard
                    key={s.id}
                    seq={s}
                    expanded={expanded === s.id}
                    onExpand={() => setExpanded(expanded === s.id ? null : s.id)}
                    onEdit={() => setEditor({ mode: "edit", seq: s })}
                    onToggle={() => toggle.mutate({ id: s.id, active: !s.active })}
                  />
                ))}
              </div>
            </details>
          );
        })}

      {editor && (
        <SequenceEditor
          mode={editor.mode}
          initial={editor.seq}
          triggerLabels={pack.triggerLabels}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            qc.invalidateQueries({ queryKey: ["sequences"] });
          }}
        />
      )}

      {varsOpen && <VariablesModal onClose={() => setVarsOpen(false)} />}
    </div>
  );
}
