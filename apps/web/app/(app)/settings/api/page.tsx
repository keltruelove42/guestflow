"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Toast, useToast } from "@/components/ui/toast";
import { UpgradeChip, usePlan } from "@/components/upgrade";
import { api, ApiError } from "@/lib/api";

type ApiKey = {
  id: string;
  label: string;
  last4: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function ApiMcpSettingsPage() {
  const qc = useQueryClient();
  const { hasGrowth } = usePlan();
  const { toast, showToast } = useToast();
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "https://leadcoda.app/api/mcp";

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api<ApiKey[]>("/api/v1/api-keys").catch(() => [] as ApiKey[]),
    enabled: hasGrowth,
  });

  async function createKey() {
    setCreating(true);
    try {
      const res = await api<ApiKey & { key: string }>("/api/v1/api-keys", {
        method: "POST",
        body: { label: label.trim() || "API key" },
        errorMessage: "Could not create key",
      });
      setFreshKey(res.key);
      setLabel("");
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    try {
      await api(`/api/v1/api-keys/${id}`, { method: "DELETE", errorMessage: "Revoke failed" });
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      showToast("Key revoked.");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Revoke failed");
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          API &amp; MCP {!hasGrowth && <UpgradeChip />}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          Connect your CRM to any AI assistant. LeadCoda runs an MCP server, so Claude, ChatGPT,
          or your own agent can search leads, send messages, check availability, and book —
          securely scoped to your workspace by an API key.
        </p>
      </div>

      {!hasGrowth ? (
        <div className="rounded-card border border-[var(--border)] bg-surface p-5 text-sm text-ink-2">
          API access and the MCP server are included with the{" "}
          <span className="font-medium text-ink">Growth</span> plan.{" "}
          <a href="/settings/billing" className="text-accent">
            Upgrade to enable them.
          </a>
        </div>
      ) : (
        <>
          {/* MCP connection details */}
          <div className="rounded-card border border-[var(--border)] bg-surface p-5">
            <h3 className="text-sm font-semibold">Your MCP endpoint</h3>
            <code className="mt-2 block break-all rounded-control bg-surface-2 px-3 py-2 text-xs">
              {mcpUrl}
            </code>
            <p className="mt-3 text-xs text-ink-2">
              In a client that supports remote MCP servers (e.g. Claude Desktop), add an HTTP MCP
              server with this URL and an{" "}
              <code className="rounded bg-surface-2 px-1">Authorization: Bearer &lt;your key&gt;</code>{" "}
              header. Example config:
            </p>
            <pre className="mt-2 overflow-auto rounded-control bg-surface-2 p-3 text-[11px] leading-relaxed">
{`{
  "mcpServers": {
    "leadcoda": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer YOUR_KEY" }
    }
  }
}`}
            </pre>
          </div>

          {/* Create key */}
          <div className="rounded-card border border-[var(--border)] bg-surface p-5">
            <h3 className="text-sm font-semibold">API keys</h3>
            <div className="mt-3 flex gap-2">
              <Input
                className="flex-1"
                value={label}
                placeholder="Key name (e.g. My Claude)"
                onChange={(e) => setLabel(e.target.value)}
              />
              <Button variant="primary" disabled={creating} onClick={createKey}>
                {creating ? "Creating…" : "Create key"}
              </Button>
            </div>

            {freshKey && (
              <div className="mt-3 rounded-control border border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-3">
                <p className="text-xs font-medium">Copy this key now — it won't be shown again.</p>
                <code className="mt-1 block break-all rounded bg-surface px-2 py-1.5 text-xs">
                  {freshKey}
                </code>
                <button
                  type="button"
                  className="mt-2 text-xs text-accent"
                  onClick={() => {
                    void navigator.clipboard?.writeText(freshKey);
                    showToast("Copied.");
                  }}
                >
                  Copy to clipboard
                </button>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {keys.length === 0 && (
                <p className="text-xs text-muted">No keys yet.</p>
              )}
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-2 rounded-control border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{k.label}</span>
                      <Badge tone="neutral" size="xs">
                        …{k.last4}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted">
                      {k.lastUsedAt
                        ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : "Never used"}
                    </p>
                  </div>
                  <Button variant="danger" size="xs" onClick={() => revoke(k.id)}>
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted">
            Keys act on your whole workspace and respect the same consent, quiet-hours, and
            sending limits as the app. Revoke a key anytime.
          </p>
        </>
      )}

      <Toast message={toast} />
    </div>
  );
}
