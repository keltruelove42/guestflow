import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

const CATALOG: Array<{
  provider: string;
  name: string;
  desc: string;
  icon: string;
  bg: string;
}> = [
  {
    provider: "meta",
    name: "Meta Lead Ads",
    desc: "Sync instant-form leads from Instagram & Facebook in real time.",
    icon: "📘",
    bg: "#1877f2",
  },
  {
    provider: "tiktok",
    name: "TikTok Lead Gen",
    desc: "Pull leads from TikTok Instant Forms via the Business API.",
    icon: "🎵",
    bg: "#111",
  },
  {
    provider: "pinterest",
    name: "Pinterest Ads",
    desc: "Capture lead ad submissions from Pinterest campaigns.",
    icon: "📌",
    bg: "#e60023",
  },
  {
    provider: "hostfully",
    name: "Hostfully",
    desc: "Import inquiries & quotes; detect abandoned inquiries automatically.",
    icon: "🏡",
    bg: "#00a699",
  },
  {
    provider: "hostaway",
    name: "Hostaway",
    desc: "Sync inquiries, reservations and guest profiles from Hostaway PMS.",
    icon: "🧭",
    bg: "#f5a623",
  },
  {
    provider: "stayfi",
    name: "StayFi",
    desc: "Capture in-stay guest email & phone via WiFi splash pages.",
    icon: "📶",
    bg: "#0ea5e9",
  },
  {
    provider: "ownerrez",
    name: "OwnerRez",
    desc: "Sync inquiries, quotes and guests from OwnerRez.",
    icon: "🔑",
    bg: "#5a67d8",
  },
  {
    provider: "lodgify",
    name: "Lodgify",
    desc: "Capture visitors who start but don't finish a booking.",
    icon: "🛎️",
    bg: "#7c3aed",
  },
  {
    provider: "klaviyo",
    name: "Klaviyo",
    desc: "Push segments & mirror follow-up emails through Klaviyo.",
    icon: "✉️",
    bg: "#0f172a",
  },
  {
    provider: "twilio",
    name: "Twilio SMS",
    desc: "Send automated text follow-ups from your own number.",
    icon: "💬",
    bg: "#f22f46",
  },
  {
    provider: "stripe",
    name: "Stripe",
    desc: "Attribute recovered bookings & revenue back to campaigns.",
    icon: "💳",
    bg: "#635bff",
  },
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.integration.findMany({
    where: { orgId: session.orgId },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return NextResponse.json(
    CATALOG.map((c) => {
      const row = byProvider.get(c.provider);
      return {
        ...c,
        id: row?.id ?? null,
        status: row?.status ?? "DISCONNECTED",
        lastSyncAt: row?.lastSyncAt ?? null,
        lastError: row?.lastError ?? null,
        isDemo: row?.isDemo ?? false,
      };
    }),
  );
}
