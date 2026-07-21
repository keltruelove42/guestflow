"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";

type Integration = {
  provider: string;
  name: string;
  desc: string;
  icon: string;
  bg: string;
  status: string;
  lastSyncAt: string | null;
  isDemo: boolean;
};

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/integrations");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Integration[]>;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      provider,
      connect,
    }: {
      provider: string;
      connect: boolean;
    }) => {
      const path = connect ? "connect" : "disconnect";
      const res = await fetch(`/api/v1/integrations/${provider}/${path}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_d, vars) => {
      if (vars.connect) onboarding?.markAction("integration");
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  return (
    <div className="space-y-5">
      <p className="max-w-xl text-sm text-ink-2">
        Connections are simulated in demo mode. Connect/disconnect freely — live Hostfully, StayFi,
        Meta, and Twilio wire up later. Demo “connected” badges clear with{" "}
        <b>Clear demo data</b>.
      </p>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => {
          const on = i.status === "CONNECTED";
          return (
            <div
              key={i.provider}
              className="rounded-card border border-[var(--border)] bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-control text-lg"
                  style={{ background: i.bg, color: "#fff" }}
                >
                  {i.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <b className="truncate text-sm">{i.name}</b>
                    {i.isDemo && on && (
                      <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                        Demo
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-2">{i.desc}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: on ? "var(--good)" : "var(--muted)",
                    }}
                  />
                  {on ? "Connected" : "Not connected"}
                </span>
                <button
                  type="button"
                  className={`rounded-control px-2.5 py-1.5 text-xs font-medium ${
                    on
                      ? "border border-[var(--border)]"
                      : "bg-accent text-white"
                  }`}
                  onClick={() =>
                    toggle.mutate({ provider: i.provider, connect: !on })
                  }
                >
                  {on ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
