"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export type AiSuggestion = {
  id: string;
  channel: "EMAIL" | "SMS";
  draft: string;
  rationale: string | null;
  createdAt: string;
};

export function AiSuggestionCard({
  leadId,
  suggestion,
  onToast,
}: {
  leadId: string;
  suggestion: AiSuggestion;
  onToast: (message: string) => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState(suggestion.draft);

  // Reseed the editor when a new suggestion arrives.
  useEffect(() => {
    setBody(suggestion.draft);
  }, [suggestion.id, suggestion.draft]);

  const act = useMutation({
    mutationFn: (input: { action: "send"; body: string } | { action: "dismiss" }) =>
      api<{ ok?: boolean; error?: string }>(`/api/v1/suggestions/${suggestion.id}`, {
        method: "POST",
        body: input,
        errorMessage: "Could not update the suggestion",
      }),
    onSuccess: async (_res, input) => {
      onToast(input.action === "send" ? "Reply sent." : "Suggestion dismissed.");
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) =>
      onToast(e instanceof ApiError ? e.message : "Could not update the suggestion"),
  });

  return (
    <section
      className="mb-4 rounded-card border p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))",
        background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">✨ AI suggested reply</h3>
        <Badge tone="accent" size="sm">
          {suggestion.channel}
        </Badge>
        <span className="text-xs text-muted">{relativeTime(suggestion.createdAt)}</span>
      </div>

      {suggestion.rationale && (
        <p className="mt-1 text-xs text-muted">{suggestion.rationale}</p>
      )}

      <Textarea
        className="mt-3 min-h-[110px] bg-surface"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={act.isPending}
        aria-label="Suggested reply draft"
      />

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={act.isPending || !body.trim()}
          onClick={() => act.mutate({ action: "send", body })}
        >
          {act.isPending ? "Sending…" : "Send"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={act.isPending}
          onClick={() => act.mutate({ action: "dismiss" })}
        >
          Dismiss
        </Button>
      </div>
    </section>
  );
}
