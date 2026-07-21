# 04 — API Spec

All endpoints under `/api/v1/*`, JSON, authenticated with Supabase JWT (`Authorization: Bearer`), scoped to the token's `orgId`. Request/response shapes are Zod schemas in `packages/shared/src/schemas` — the source of truth; this doc is the human summary. `packages/api-client` wraps every endpoint in a typed function used by both web and mobile.

Conventions: cursor pagination (`?cursor=&limit=` → `{items, nextCursor}`); errors `{error: {code, message}}` with proper status; all writes return the updated resource; all list endpoints accept `propertyId` filter.

## Properties

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /properties` | `?includeArchived` | `Property[]` with `leadCount`, `activeCampaignCount` |
| `POST /properties` | `{name, location?, bedrooms?, type, directBookingUrl?, knowledgeBase?}` | `Property` |
| `PATCH /properties/:id` | partial | `Property` |
| `POST /properties/:id/archive` | — | `Property` |

## Leads

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /leads` | `?stage=&source=&propertyId=&q=&cursor=` | `{items: LeadListItem[], nextCursor}` (includes active enrollment summary) |
| `GET /leads/:id` | — | `LeadDetail`: lead + events (desc) + notes + enrollments + pending scheduled messages |
| `POST /leads` | `{name, email?, phone?, address?, propertyId?, travelDates?, partySize?, enrollSequenceId?}` | `Lead` (runs dedupe; `201` created / `200` merged) |
| `PATCH /leads/:id` | partial contact/stage fields | `Lead` (stage change writes `STAGE_CHANGED`; `BOOKED` → see below) |
| `POST /leads/:id/stage` | `{stage, bookingAmountCents?}` | `Lead` — `BOOKED` stops enrollments, creates `Booking`, runs attribution |
| `POST /leads/:id/enroll` | `{sequenceId}` | `Enrollment` (409 if already actively enrolled in it) |
| `POST /leads/:id/messages` | `{channel, subject?, body, viaAi?: boolean}` | `LeadEvent` — manual/AI send through the same pipeline (consent enforced; pauses active enrollment) |
| `POST /leads/:id/notes` | `{text}` | `Note` |
| `POST /leads/:id/ai-draft` | `{regenerate?: boolean}` | `{draft: string}` (see 09) |
| `POST /leads/import` | multipart CSV + `{mapping: {col→field}}` | `{created, merged, skipped, errors[]}` |
| `DELETE /leads/:id` | — | 204 (hard-deletes contact fields + cascade) |

## Campaigns

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /campaigns` | `?status=&platform=&propertyId=` | `Campaign[]` (computed `costPerLeadCents`) |
| `POST /campaigns` | full wizard payload: `{platform, propertyId, name, audience, dailyBudgetCents, leadForm, autoEnrollSequenceId}` | `Campaign` (status `DRAFT`) |
| `POST /campaigns/:id/launch` | — | `Campaign` — demo mode: → `ACTIVE`; live: provider `createCampaign()` → `IN_REVIEW` |
| `POST /campaigns/:id/pause` / `.../resume` | — | `Campaign` |
| `GET /campaigns/:id/form-preview` | — | `{propertyName, fields[], consentCopy}` (drives form preview UI) |

## Sequences

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /sequences` | — | `Sequence[]` with steps + stats `{enrolled, replies, replyRate, booked}` |
| `POST /sequences` | `{name, trigger, steps: [{delayMinutes, channel, subject?, body}]}` | `Sequence` |
| `PATCH /sequences/:id` | partial (incl. full `steps` replacement) | `Sequence` (future `ScheduledMessage`s of edited steps recomputed) |
| `POST /sequences/:id/activate` / `.../pause` | — | `Sequence` (pause → active enrollments hold; no sends while paused) |
| `POST /enrollments/:id/pause` / `.../resume` / `.../stop` | — | `Enrollment` |

## Dashboard & activity

| Method & path | Returns |
|---|---|
| `GET /dashboard/kpis?propertyId=` | `{newLeads30d, newLeadsDeltaPct, blendedCplCents, replyRatePct, recoveredBookings, attributedRevenueCents}` |
| `GET /dashboard/leads-by-week?weeks=8` | `[{weekStart, meta, tiktok, direct, pinterest, wifi, manual}]` |
| `GET /dashboard/leads-by-source` | `[{source, count}]` |
| `GET /activity?cursor=` | org-wide `LeadEvent` feed (joined with lead name) |
| `GET /attention` | leads where `needsAttention=true` (paused enrollments awaiting reply) |

## Integrations

| Method & path | Body | Returns |
|---|---|---|
| `GET /integrations` | — | all providers with `{status, lastSyncAt, lastError}` |
| `POST /integrations/:provider/connect` | `{apiKey?}` or `{}` → `{oauthUrl}` for OAuth providers | `Integration` or redirect URL |
| `GET /integrations/:provider/callback` | OAuth code (browser redirect) | 302 → `/integrations` |
| `POST /integrations/:provider/disconnect` | — | `Integration` |
| `POST /integrations/:provider/sync` | — | manual sync trigger `{synced}` |

## Devices (mobile push)

| Method & path | Body |
|---|---|
| `POST /devices` | `{expoPushToken}` → registers on `User.expoPushTokens` |
| `DELETE /devices` | `{expoPushToken}` |

## Simulator (demo/dev only — gated on `Org.mode==='DEMO'`)

| Method & path | Body | Behavior |
|---|---|---|
| `POST /simulate/lead` | `{kind?: 'ad'\|'abandoned', platform?}` | Builds a realistic payload and POSTs it to the org's own webhook handler — exercises the real pipeline |
| `POST /simulate/reply` | `{leadId, text?}` | Simulates inbound reply → pause + notification path |
| `POST /simulate/tick` | `{advanceMinutes}` | Dev-only time advance: rewrites pending `sendAt`s to test sequences quickly |

---

## Webhooks (unauthenticated paths, signature-verified)

| Path | Source | Verification | Handler |
|---|---|---|---|
| `GET/POST /api/webhooks/meta` | Meta leadgen | `hub.challenge` echo (GET), `X-Hub-Signature-256` HMAC (POST) | fetch full lead via Graph API by `leadgen_id` → `core.leads.createFromCapture` |
| `POST /api/webhooks/tiktok` | TikTok lead | signature per TikTok spec | same core path |
| `POST /api/webhooks/pinterest` | Pinterest lead | signature | same core path |
| `POST /api/webhooks/pms/:provider` | Hostfully/Hostaway push (where supported) | per-provider secret | `core.integrations.pms.ingestInquiry` |
| `POST /api/webhooks/twilio` | inbound SMS | Twilio signature | `core.messaging.recordInbound` — handles `STOP`/`HELP`, else reply event + pause |
| `POST /api/webhooks/resend` | email events (delivered/bounce/complaint) | Svix signature | bounce/complaint → suppress + event |

## Cron

`GET /api/jobs/tick` — header `Authorization: Bearer ${CRON_SECRET}`, invoked every minute (Vercel Cron). Runs the four scheduler phases from `02-architecture.md`. Must be safe to run concurrently (row-level claim: `UPDATE ... SET status='SENDING' WHERE id IN (...) AND status='PENDING' RETURNING *` pattern or `FOR UPDATE SKIP LOCKED`).
