# 08 — Integrations

Every external system sits behind an interface in `packages/core/src/integrations`. **Every provider ships with a mock** that satisfies the same interface, so the whole product runs end-to-end with zero external accounts (demo mode), and real providers are drop-in. Product code (leads, sequences, UI) never imports a concrete provider — only the registry.

```ts
// registry resolves per-org from the Integration table
getAdsProvider(orgId, platform): AdsProvider          // Mock if not CONNECTED
getPmsProviders(orgId): PmsProvider[]                 // all connected PMSs
getEmailSender(orgId): EmailSender                    // Mock in DEMO mode
getSmsSender(orgId): SmsSender

interface AdsProvider {
  createCampaign(c: CampaignInput): Promise<{externalId, status}>
  setStatus(externalId, "ACTIVE"|"PAUSED"): Promise<void>
  syncMetrics(externalId): Promise<{spendCents, impressions, clicks, leadsCount}>
  fetchLead(platformLeadId): Promise<CapturedLead>     // called from webhook handlers
}
interface PmsProvider {
  syncInquiries(since: Date): Promise<PmsInquiry[]>    // poller (15 min default)
  syncBookings(since: Date): Promise<PmsBooking[]>     // stops sequences + attribution + checkoutAt
}
interface EmailSender { send(msg): Promise<{providerId}> }   // Resend | LoggingMock
interface SmsSender   { send(msg): Promise<{providerId}> }   // Twilio | LoggingMock

type CapturedLead = { externalRef, name, email?, phone?, address?, travelDates?,
                      partySize?, platform, campaignExternalId?, consentText, raw }
type PmsInquiry   = { externalRef, propertyExternalId?, name, email?, phone?,
                      dates?, partySize?, startedAt, completedBooking: boolean }
```

Credentials: `Integration.credentials` encrypted at rest (AES-256-GCM with `CREDENTIALS_KEY` env; simple `encryptJson/decryptJson` helper). Never returned by the API; UI only sees status.

## Per-provider notes

### Meta Lead Ads (Instagram + Facebook) — the flagship
- **Connect:** OAuth (Facebook Login for Business) requesting `ads_management, leads_retrieval, pages_manage_ads, pages_show_list`. Store page + ad account ids in `config`. App review is required for `leads_retrieval` in production — plan for it; dev works with app-role users immediately.
- **Capture:** subscribe the page to `leadgen` webhooks. Webhook delivers `leadgen_id` → fetch full field data via Graph API → map to `CapturedLead` (custom questions map by field key: email/phone/address/dates/party). Meta lead forms include consent disclaimer text — store it in `meta`.
- **Campaign creation (live):** Marketing API: campaign (objective `OUTCOME_LEADS`) → ad set (targeting from wizard audience, daily budget) → lead form (from wizard fields) → ad (creative = boosted post or uploaded image; MVP: reuse an existing post id the user pastes, full creative upload post-MVP) → status `IN_REVIEW`.
- **Metrics:** Insights API daily sync (spend, impressions, clicks) + lead count from our own rows.

### TikTok Lead Generation
- OAuth via TikTok for Business; `lead_management` scope. Leads via webhook (or `lead/get` polling fallback). Campaign creation mirrors Meta's flow with TikTok's objects; MVP may ship `syncMetrics` + capture only, with creation stubbed to "create in TikTok Ads Manager, paste campaign id to link".

### Pinterest Ads
- OAuth; lead ads are limited-availability — implement capture (webhook/poll) + metrics; creation stubbed like TikTok. Mock provider fully functional regardless.

### Hostfully (PMS / direct booking)
- API-key connect (agency key). Poll inquiries/quotes (`syncInquiries`, 15 min): an inquiry or quote with no confirmed reservation → `PmsInquiry{completedBooking:false}` → lead pipeline handles abandonment windows. Poll reservations (`syncBookings`) → match to leads by email/phone/externalRef → mark BOOKED + `checkoutAt`.
- Map Hostfully property ids → GuestFlow properties in `config.propertyMap` (UI: simple mapping table in the connect modal).

### Hostaway
- OAuth2 client-credentials (account id + secret). Same interface: inquiries/reservations endpoints; reservation status transitions (`inquiry → pending → confirmed`) drive abandoned detection and booking sync. Same property-mapping config.

### StayFi (in-stay WiFi capture)
- API key. Poll new guest contacts → create leads `source=WIFI`, `emailConsent` per StayFi's captured consent, attach to property via mapping. These leads skip welcome sequences and are eligible for `CHECKOUT_PLUS_90D` re-engagement (their stay is already known). CSV import path doubles as fallback if API access is unavailable.

### OwnerRez / Lodgify
- Same `PmsProvider` interface. MVP: cards present, connect = API key stored, sync marked "coming soon" unless time allows — mocks make the UI honest about status.

### Twilio (SMS)
- Credential form (SID, auth token, from-number). Outbound via `SmsSender`; inbound + STOP/HELP via `/api/webhooks/twilio` (signature-verified). A2P 10DLC registration is an operational prerequisite for US traffic — surface a checklist link in the connect modal.

### Resend (email)
- Platform-level (env key) rather than per-org in MVP; org sets from-name/reply-to. Inbound replies: MVP uses a per-lead reply-to alias (`reply+<leadId>@mail.yourdomain.com` via Resend inbound routing) → `recordInbound`.

### Klaviyo (optional mirror)
- OAuth/API key. On connect: push leads as profiles (email ones), sync consent, and emit events (`GuestFlow Lead Captured`, `Sequence Email Sent`) so the user's existing Klaviyo flows/analytics see everything. GuestFlow remains the sender of record for sequences in MVP.

### Stripe (attribution enrichment)
- Connect OAuth (post-MVP-optional): match direct-site payments to leads for exact revenue; MVP records amounts manually or from PMS booking totals.

## Mock providers (demo mode) — required behavior

- `MockAdsProvider`: `createCampaign` → returns id, status ACTIVE after 30s ("review"); `syncMetrics` → deterministic drift (spend += budget/24 per hourly sync, leads at a plausible CPL) so dashboards move.
- `MockPmsProvider`: every sync, small chance of a new inquiry from a name pool; occasionally converts an old inquiry to a booking (exercises stop+attribution).
- `LoggingEmailSender`/`LoggingSmsSender`: write the fully rendered message to `LeadEvent` (exactly like live) and console/log table — nothing leaves the machine.
- The **simulator endpoints** (`04-api-spec.md`) reuse these to inject specific scenarios on demand.

## Failure handling (all providers)

Sync errors → `Integration.lastError` + status stays CONNECTED (transient) or flips ERROR (auth revoked); integrations page surfaces it with a Reconnect CTA. Webhook handlers: verify signature → 200-fast (enqueue via ScheduledMessage-style row or process inline if <2s) → idempotent by `externalRef`. Rate limits: pollers respect per-provider intervals + exponential backoff on 429.
