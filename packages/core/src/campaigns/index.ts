import { prisma, type AdPlatform, type CampaignStatus } from "@guestflow/db";
import { getAdsProvider } from "../integrations";

export type CreateCampaignInput = {
  orgId: string;
  platform: AdPlatform;
  name: string;
  propertyId?: string | null;
  dailyBudgetCents: number;
  audience: Record<string, unknown>;
  leadForm: Array<{ key: string; label: string; required: boolean }>;
  autoEnrollSequenceId?: string | null;
  isDemo?: boolean;
};

function audienceSummary(audience: Record<string, unknown>): string {
  if (typeof audience.summary === "string" && audience.summary) return audience.summary;
  const loc = String(audience.locations ?? audience.loc ?? "");
  const age = String(audience.ageRange ?? audience.age ?? "");
  const interests = Array.isArray(audience.interests)
    ? (audience.interests as string[]).join(", ")
    : "";
  const smart = Array.isArray(audience.smartAudiences)
    ? (audience.smartAudiences as string[]).filter(Boolean).join(", ")
    : "";
  return [loc, age, interests, smart].filter(Boolean).join(" · ") || "Broad audience";
}

export async function createCampaign(input: CreateCampaignInput) {
  const summary = audienceSummary(input.audience);
  return prisma.campaign.create({
    data: {
      orgId: input.orgId,
      platform: input.platform,
      name: input.name,
      propertyId: input.propertyId ?? null,
      dailyBudgetCents: input.dailyBudgetCents,
      audience: { ...input.audience, summary },
      leadForm: input.leadForm,
      autoEnrollSequenceId: input.autoEnrollSequenceId ?? null,
      status: "DRAFT",
      isDemo: input.isDemo ?? false,
    },
    include: { property: { select: { id: true, name: true } } },
  });
}

export async function launchCampaign(campaignId: string, orgId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "ACTIVE") return campaign;

  const provider = await getAdsProvider(orgId, campaign.platform);
  const audience =
    typeof campaign.audience === "object" && campaign.audience
      ? (campaign.audience as Record<string, unknown>)
      : {};
  const leadForm = Array.isArray(campaign.leadForm)
    ? (campaign.leadForm as Array<{ key: string; label: string; required: boolean }>)
    : [];

  const result = await provider.createCampaign({
    name: campaign.name,
    dailyBudgetCents: campaign.dailyBudgetCents,
    audience,
    leadForm,
  });

  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  // DECISION: DEMO launches go ACTIVE immediately; LIVE stays IN_REVIEW until provider says otherwise
  const status: CampaignStatus =
    org.mode === "DEMO" ? "ACTIVE" : result.status === "ACTIVE" ? "ACTIVE" : "IN_REVIEW";

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status,
      externalCampaignId: result.externalId,
      startedAt: new Date(),
    },
    include: { property: { select: { id: true, name: true } } },
  });
}

export type UpdateCampaignInput = Partial<{
  platform: AdPlatform;
  name: string;
  propertyId: string | null;
  dailyBudgetCents: number;
  audience: Record<string, unknown>;
  leadForm: Array<{ key: string; label: string; required: boolean }>;
  autoEnrollSequenceId: string | null;
}>;

/** Edit a campaign. Platform is locked once the campaign has launched. */
export async function updateCampaign(
  campaignId: string,
  orgId: string,
  input: UpdateCampaignInput,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "ENDED") throw new Error("Campaign has ended");
  if (
    input.platform &&
    input.platform !== campaign.platform &&
    campaign.status !== "DRAFT"
  ) {
    throw new Error("Platform can only change while the campaign is a draft");
  }

  const audience =
    input.audience !== undefined
      ? { ...input.audience, summary: audienceSummary(input.audience) }
      : undefined;

  return prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      ...(input.platform !== undefined ? { platform: input.platform } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
      ...(input.dailyBudgetCents !== undefined
        ? { dailyBudgetCents: input.dailyBudgetCents }
        : {}),
      ...(audience !== undefined ? { audience } : {}),
      ...(input.leadForm !== undefined ? { leadForm: input.leadForm } : {}),
      ...(input.autoEnrollSequenceId !== undefined
        ? { autoEnrollSequenceId: input.autoEnrollSequenceId }
        : {}),
    },
    include: { property: { select: { id: true, name: true } } },
  });
}

/** End a campaign permanently (pauses on the provider first if launched). */
export async function endCampaign(campaignId: string, orgId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "ENDED") return campaign;

  if (campaign.externalCampaignId && campaign.status === "ACTIVE") {
    const provider = await getAdsProvider(orgId, campaign.platform);
    await provider.setStatus(campaign.externalCampaignId, "PAUSED");
  }

  return prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ENDED" },
    include: { property: { select: { id: true, name: true } } },
  });
}

export async function setCampaignStatus(
  campaignId: string,
  orgId: string,
  status: "ACTIVE" | "PAUSED",
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId },
  });
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.externalCampaignId) {
    const provider = await getAdsProvider(orgId, campaign.platform);
    await provider.setStatus(campaign.externalCampaignId, status);
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
    include: { property: { select: { id: true, name: true } } },
  });
}

const SIM_LEAD_NAMES = [
  "Hannah Cole",
  "Evan Brooks",
  "Riley Chen",
  "Sam Patel",
  "Morgan Diaz",
  "Alex Rivera",
  "Jordan Blake",
  "Casey Nguyen",
  "Taylor Reed",
  "Drew Santos",
];

/**
 * Create real Lead rows for a campaign's newly attributed lead count so
 * launched campaigns actually feed the pipeline (and auto-enroll their
 * sequence). Capped per sync so a big backfill can't flood the CRM.
 */
async function generateCampaignLeads(
  c: { id: string; orgId: string; propertyId: string | null; platform: AdPlatform; isDemo: boolean },
  count: number,
  now: Date,
) {
  const { createFromCapture } = await import("../leads/capture");
  const n = Math.min(count, 2);
  let created = 0;
  for (let i = 0; i < n; i++) {
    const name = SIM_LEAD_NAMES[Math.floor(Math.random() * SIM_LEAD_NAMES.length)]!;
    const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");
    const suffix = Math.floor(Math.random() * 900) + 100;
    const result = await createFromCapture({
      orgId: c.orgId,
      name,
      email: Math.random() > 0.25 ? `${slug}${suffix}@example.com` : null,
      phone:
        Math.random() > 0.35
          ? `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`
          : null,
      source: c.platform,
      propertyId: c.propertyId,
      campaignId: c.id,
      externalRef: `camp_${c.id}_${now.getTime()}_${i}`,
      emailConsent: true,
      smsConsent: true,
      consentText: "Submitted instant form (simulated delivery)",
      isDemo: c.isDemo,
      now,
    });
    if (result.created) created += 1;
  }
  return created;
}

/** Drift spend/impressions/clicks/leads for ACTIVE campaigns (demo + live mock). */
export async function syncCampaignMetrics(orgId?: string) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      ...(orgId ? { orgId } : {}),
    },
  });

  const now = new Date();
  let synced = 0;
  let leadsCreated = 0;
  for (const c of campaigns) {
    const spendAdd = Math.round(c.dailyBudgetCents / 24);
    const nextSpend = c.spendCents + spendAdd;
    const nextImpressions = c.impressions + Math.round(c.dailyBudgetCents * 1.6);
    const nextClicks = c.clicks + Math.max(1, Math.round(c.dailyBudgetCents / 40));
    const cpl = 1200;
    let floorLeads = Math.floor(nextSpend / cpl);

    if (c.externalCampaignId) {
      const provider = await getAdsProvider(c.orgId, c.platform);
      const metrics = await provider.syncMetrics(c.externalCampaignId);
      floorLeads = Math.max(floorLeads, metrics.leadsCount);
    }

    // New attributed leads become real CRM leads (auto-enrolled via capture)
    const newLeads = floorLeads - c.leadsCount;
    if (newLeads > 0) {
      leadsCreated += await generateCampaignLeads(
        { id: c.id, orgId: c.orgId, propertyId: c.propertyId, platform: c.platform, isDemo: c.isDemo },
        newLeads,
        now,
      );
    }

    await prisma.campaign.update({
      where: { id: c.id },
      data: {
        spendCents: nextSpend,
        impressions: nextImpressions,
        clicks: nextClicks,
        leadsCount: Math.max(c.leadsCount + Math.max(0, Math.min(newLeads, 2)), c.leadsCount),
      },
    });
    synced += 1;
  }
  return { synced, leadsCreated };
}

export function serializeCampaign<
  T extends {
    spendCents: number;
    leadsCount: number;
    audience: unknown;
  },
>(c: T) {
  const audience = c.audience;
  const audienceSummary =
    typeof audience === "object" &&
    audience &&
    "summary" in audience &&
    typeof (audience as { summary?: unknown }).summary === "string"
      ? String((audience as { summary: string }).summary)
      : "";

  return {
    ...c,
    costPerLeadCents:
      c.leadsCount > 0 ? Math.round(c.spendCents / c.leadsCount) : null,
    audienceSummary,
  };
}
