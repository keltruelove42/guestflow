import type { AdsProvider, CampaignInput, CapturedLead } from "./types";

/** Deterministic mock ads provider for DEMO mode */
export class MockAdsProvider implements AdsProvider {
  private budgets = new Map<string, number>();
  private metrics = new Map<
    string,
    { spendCents: number; impressions: number; clicks: number; leadsCount: number }
  >();

  async createCampaign(
    c: CampaignInput,
  ): Promise<{ externalId: string; status: "IN_REVIEW" | "ACTIVE" }> {
    const externalId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.budgets.set(externalId, c.dailyBudgetCents);
    this.metrics.set(externalId, {
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      leadsCount: 0,
    });
    // DECISION: return ACTIVE immediately in unit tests; UI simulates 30s review via status poll
    return { externalId, status: "ACTIVE" };
  }

  async setStatus(_externalId: string, _status: "ACTIVE" | "PAUSED"): Promise<void> {
    // no-op in mock
  }

  async syncMetrics(externalId: string) {
    const budget = this.budgets.get(externalId) ?? 2500;
    const current = this.metrics.get(externalId) ?? {
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      leadsCount: 0,
    };
    // Deterministic drift: spend += budget/24 per hourly sync
    current.spendCents += Math.round(budget / 24);
    current.impressions += Math.round(budget * 1.6);
    current.clicks += Math.max(1, Math.round(budget / 40));
    const cpl = 1200; // ~$12 CPL
    current.leadsCount = Math.floor(current.spendCents / cpl);
    this.metrics.set(externalId, current);
    return { ...current };
  }

  async fetchLead(platformLeadId: string): Promise<CapturedLead> {
    return {
      externalRef: platformLeadId,
      name: "Simulated Lead",
      email: `lead+${platformLeadId.slice(-6)}@example.com`,
      phone: undefined,
      platform: "META",
      consentText: "I agree to be contacted about this property.",
    };
  }
}
