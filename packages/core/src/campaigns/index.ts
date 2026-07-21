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

/** Drift spend/impressions/clicks/leads for ACTIVE campaigns (demo + live mock). */
export async function syncCampaignMetrics(orgId?: string) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      ...(orgId ? { orgId } : {}),
    },
  });

  let synced = 0;
  for (const c of campaigns) {
    const provider = await getAdsProvider(c.orgId, c.platform);
    // Seed mock cache with current DB values + budget so drift continues across restarts
    if (c.externalCampaignId) {
      const metrics = await provider.syncMetrics(c.externalCampaignId);
      // Prefer budget-based drift from our row so restart-safe
      const spendAdd = Math.round(c.dailyBudgetCents / 24);
      const nextSpend = c.spendCents + spendAdd;
      const nextImpressions = c.impressions + Math.round(c.dailyBudgetCents * 1.6);
      const nextClicks = c.clicks + Math.max(1, Math.round(c.dailyBudgetCents / 40));
      const cpl = 1200;
      const nextLeads = Math.max(c.leadsCount, Math.floor(nextSpend / cpl));

      await prisma.campaign.update({
        where: { id: c.id },
        data: {
          spendCents: nextSpend,
          impressions: nextImpressions,
          clicks: nextClicks,
          // Keep leadsCount at least as high as CRM-attributed; metrics floor from spend
          leadsCount: Math.max(c.leadsCount, metrics.leadsCount, nextLeads),
        },
      });
      synced += 1;
    } else {
      // Active without external id (seeded): still drift
      const spendAdd = Math.round(c.dailyBudgetCents / 24);
      const nextSpend = c.spendCents + spendAdd;
      await prisma.campaign.update({
        where: { id: c.id },
        data: {
          spendCents: nextSpend,
          impressions: c.impressions + Math.round(c.dailyBudgetCents * 1.6),
          clicks: c.clicks + Math.max(1, Math.round(c.dailyBudgetCents / 40)),
          leadsCount: Math.max(c.leadsCount, Math.floor(nextSpend / 1200)),
        },
      });
      synced += 1;
    }
  }
  return { synced };
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
