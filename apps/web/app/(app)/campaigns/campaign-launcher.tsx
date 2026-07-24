"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icons";
import { api } from "@/lib/api";

type View = "picker" | "ad" | "reactivation" | "reviews" | "referral";

type Channel = {
  id: Exclude<View, "picker">;
  icon: IconName;
  title: string;
  desc: string;
};

const CHANNELS: Channel[] = [
  {
    id: "ad",
    icon: "megaphone",
    title: "Ad campaign",
    desc: "Meta, TikTok or Pinterest lead ads.",
  },
  {
    id: "reactivation",
    icon: "repeat",
    title: "Reactivation",
    desc: "Win back past & dormant leads with one text or email.",
  },
  {
    id: "reviews",
    icon: "star",
    title: "Reviews",
    desc: "Auto-ask happy customers for a Google/Airbnb review.",
  },
  {
    id: "referral",
    icon: "gift",
    title: "Referral",
    desc: "Turn customers into referrals with a shareable link.",
  },
];

const TITLES: Record<Exclude<View, "picker">, string> = {
  ad: "Ad campaign",
  reactivation: "Reactivation",
  reviews: "Reviews",
  referral: "Referral",
};

export function CampaignLauncher({
  onClose,
  onPickAd,
  showToast,
}: {
  onClose: () => void;
  onPickAd: () => void;
  showToast: (message: string) => void;
}) {
  const [view, setView] = useState<View>("picker");

  function pick(id: Channel["id"]) {
    if (id === "ad") {
      onPickAd();
      return;
    }
    setView(id);
  }

  const title =
    view === "picker" ? "New campaign" : `New campaign · ${TITLES[view]}`;

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div className="p-5">
        {view !== "picker" && (
          <button
            type="button"
            className="mb-4 text-sm text-accent"
            onClick={() => setView("picker")}
          >
            ← All channels
          </button>
        )}

        {view === "picker" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                className="cursor-pointer rounded-card border border-[var(--border)] bg-page p-4 text-left transition-colors hover:border-accent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-control bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent">
                  <Icon name={c.icon} size={18} />
                </div>
                <div className="mt-2 text-sm font-semibold">{c.title}</div>
                <div className="mt-0.5 text-xs text-muted">{c.desc}</div>
              </button>
            ))}
          </div>
        )}

        {view === "reactivation" && (
          <ReactivationPanel showToast={showToast} onDone={onClose} />
        )}
        {view === "reviews" && (
          <ReviewsPanel showToast={showToast} onDone={onClose} />
        )}
        {view === "referral" && <ReferralPanel showToast={showToast} />}
      </div>
    </Modal>
  );
}

/* ------------------------------- Reactivation ------------------------------ */

type Segment = { id: string; label: string; hint?: string };
type Preview = { total: number; reachable: number };
type ReactivateGet = { segments: Segment[]; preview?: Preview };

function ReactivationPanel({
  showToast,
  onDone,
}: {
  showToast: (message: string) => void;
  onDone: () => void;
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segment, setSegment] = useState("");
  const [channel, setChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load segments once, and refetch preview whenever segment/channel change.
  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams();
    if (segment) qs.set("segment", segment);
    qs.set("channel", channel);
    api<ReactivateGet>(`/api/v1/campaigns/reactivate?${qs.toString()}`)
      .then((data) => {
        if (!active) return;
        setSegments(data.segments);
        if (!segment && data.segments[0]) setSegment(data.segments[0].id);
        setPreview(data.preview ?? null);
      })
      .catch(() => {
        if (active) setPreview(null);
      });
    return () => {
      active = false;
    };
  }, [segment, channel]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      if (!segment) throw new Error("Pick a segment");
      if (!message.trim()) throw new Error("Add a message");
      const useEmergency = channel === "SMS" && emergency;
      if (useEmergency && !emergencyReason.trim()) {
        throw new Error("Add a short reason for the emergency send");
      }
      const res = await api<{ sent: number; skipped: number }>(
        "/api/v1/campaigns/reactivate",
        {
          method: "POST",
          body: {
            segment,
            channel,
            ...(channel === "EMAIL" ? { subject } : {}),
            message,
            ...(useEmergency
              ? { emergency: true, emergencyReason: emergencyReason.trim() }
              : {}),
          },
          errorMessage: "Could not send",
        },
      );
      showToast(`Sent to ${res.sent} leads (skipped ${res.skipped})`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  }

  const selected = segments.find((s) => s.id === segment);

  return (
    <div className="space-y-4">
      <Field label="Segment" hint={selected?.hint}>
        <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
          {segments.length === 0 && <option value="">Loading…</option>}
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Channel">
        <div className="flex gap-1.5">
          {(["SMS", "EMAIL"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`rounded-pill px-3 py-1 text-xs ${
                channel === c
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-ink-2"
              }`}
            >
              {c === "SMS" ? "SMS" : "Email"}
            </button>
          ))}
        </div>
      </Field>

      {preview && (
        <p className="text-xs text-ink-2">
          Will send to{" "}
          <b className="tabular-nums text-ink">{preview.reachable}</b> of{" "}
          <b className="tabular-nums text-ink">{preview.total}</b> reachable
          leads
        </p>
      )}

      {channel === "EMAIL" && (
        <Field label="Subject">
          <Input
            placeholder="We miss you — here's 10% off"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
      )}

      <Field label="Message">
        <Textarea
          rows={4}
          placeholder="Hi {{first_name}}, we'd love to have you back…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      {channel === "SMS" && (
        <div className="rounded-card border border-[var(--border)] bg-surface-2 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={emergency}
              onChange={(e) => setEmergency(e.target.checked)}
            />
            <span>
              <span className="font-medium">Emergency — send now</span>
              <span className="mt-0.5 block text-xs text-muted">
                Bypasses quiet hours. Only for genuinely urgent, time-sensitive
                texts (e.g. emergency-repair availability). Logged on each
                lead&rsquo;s timeline.
              </span>
            </span>
          </label>
          {emergency && (
            <div className="mt-2">
              <Input
                placeholder="Reason (e.g. burst-pipe emergency crew available tonight)"
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Sends immediately to consented leads; respects your limits
        {channel === "SMS" && !emergency ? " and quiet hours" : ""}.
      </p>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex justify-end">
        <Button variant="primary" disabled={sending} onClick={send}>
          {sending
            ? "Sending…"
            : channel === "SMS" && emergency
              ? "Send now (emergency)"
              : "Send now"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- Reviews -------------------------------- */

type ReviewGet = {
  enabled: boolean;
  url: string;
  message: string;
  defaultMessage: string;
};

function ReviewsPanel({
  showToast,
  onDone,
}: {
  showToast: (message: string) => void;
  onDone: () => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<ReviewGet>("/api/v1/org/review")
      .then((data) => {
        if (!active) return;
        setEnabled(data.enabled);
        setUrl(data.url);
        setMessage(data.message);
        setDefaultMessage(data.defaultMessage);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api<{ ok: boolean }>("/api/v1/org/review", {
        method: "PUT",
        body: { enabled, url, message },
        errorMessage: "Could not save",
      });
      showToast("Review request saved.");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        After a booking, LeadCoda texts or emails the customer a tracked review
        link so happy customers leave a Google or Airbnb review.
      </p>

      <Field label="Review URL">
        <Input
          placeholder="https://g.page/r/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Auto-ask after every booking
      </label>

      <Field
        label="Message"
        hint="Use {{review_link}}, {{first_name}} and {{business_name}} tags."
      >
        <Textarea
          rows={4}
          placeholder={defaultMessage}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex justify-end">
        <Button variant="primary" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Referral -------------------------------- */

type ReferralGet = {
  slug: string | null;
  link: string | null;
  stats: { referred: number; booked: number };
};

function ReferralPanel({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [data, setData] = useState<ReferralGet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<ReferralGet>("/api/v1/org/referral")
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      showToast("Referral link copied.");
    } catch {
      showToast("Could not copy link.");
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  if (!data?.link) {
    return (
      <p className="text-sm text-ink-2">
        Set a booking page URL first in Calendar settings to enable your
        referral link.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Share this link with customers. When someone they refer books, both are
        credited automatically.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-control border border-[var(--border)] bg-surface-2 px-3 py-2 text-xs">
          {data.link}
        </code>
        <Button variant="secondary" onClick={() => copy(data.link!)}>
          Copy
        </Button>
      </div>

      <p className="text-sm text-ink-2">
        Referred: <b className="tabular-nums text-ink">{data.stats.referred}</b>{" "}
        · Booked: <b className="tabular-nums text-ink">{data.stats.booked}</b>
      </p>
    </div>
  );
}
