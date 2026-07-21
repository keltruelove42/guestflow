# 02 — Architecture

## Stack (chosen for Cursor-friendliness and one-person velocity)

| Layer | Choice | Why |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Shared types between web/mobile/server; Cursor handles it well |
| Web app + API | **Next.js 14+ (App Router, TypeScript)** | One deployable for UI + REST API routes + webhooks + cron |
| Mobile | **Expo (React Native, TypeScript) + expo-router** | Fastest path to iOS/Android; OTA updates; push notifications built in |
| DB | **Postgres (Supabase)** + **Prisma** | Relational fits CRM; Supabase adds auth + realtime + hosting |
| Auth | **Supabase Auth** (email magic link + Google) | Works identically for web and Expo; JWT carries `orgId` claim |
| Jobs/scheduler | **Vercel Cron → `/api/jobs/tick`** (every minute) + `ScheduledMessage` table | No queue infra needed at MVP scale; swap for Inngest/QStash later |
| Email | **Resend** (behind `EmailSender` interface) | Simple API, good deliverability, React email templates |
| SMS | **Twilio** (behind `SmsSender` interface) | Standard; mock in demo mode |
| AI | **Claude API** (Anthropic SDK) | Reply drafting per `09-ai-assistant.md` |
| Styling web | **Tailwind + shadcn/ui** | Recreate prototype look quickly |
| Styling mobile | **NativeWind** | Same utility classes as web |
| Validation | **Zod** everywhere; schemas live in `packages/shared` | One source of truth for API contracts |
| State/data | **TanStack Query** (web + mobile) | Caching, optimistic updates, refetch on focus |

## Monorepo layout

```
guestflow/
├─ .cursorrules
├─ docs/                        # ← this spec folder
├─ package.json                 # pnpm workspaces: apps/*, packages/*
├─ turbo.json
├─ apps/
│  ├─ web/                      # Next.js — UI + API + webhooks + cron
│  │  ├─ app/
│  │  │  ├─ (app)/              # authed UI routes
│  │  │  │  ├─ dashboard/page.tsx
│  │  │  │  ├─ leads/page.tsx
│  │  │  │  ├─ campaigns/page.tsx
│  │  │  │  ├─ sequences/page.tsx
│  │  │  │  ├─ properties/page.tsx
│  │  │  │  └─ integrations/page.tsx
│  │  │  ├─ (auth)/login/page.tsx
│  │  │  └─ api/
│  │  │     ├─ v1/[...]/route.ts       # REST API (04-api-spec.md)
│  │  │     ├─ webhooks/
│  │  │     │  ├─ meta/route.ts
│  │  │     │  ├─ tiktok/route.ts
│  │  │     │  ├─ pinterest/route.ts
│  │  │     │  ├─ pms/[provider]/route.ts
│  │  │     │  └─ twilio/route.ts      # inbound SMS + STOP
│  │  │     └─ jobs/tick/route.ts      # cron: scheduler + pollers
│  │  ├─ components/            # mirrors prototype components (06-web-app.md)
│  │  ├─ lib/
│  │  └─ emails/                # React Email templates
│  └─ mobile/                   # Expo app (07-mobile-app.md)
│     ├─ app/                   # expo-router: (tabs)/dashboard|leads|more, lead/[id]
│     ├─ components/
│     └─ lib/
├─ packages/
│  ├─ shared/                   # THE contract: zod schemas, types, enums, merge-tag utils
│  │  └─ src/{schemas,types,constants,utils}/
│  ├─ db/                       # Prisma schema + client + seed (03-data-model.md)
│  │  ├─ prisma/schema.prisma
│  │  └─ src/{client.ts,seed.ts}
│  ├─ core/                     # ALL business logic — pure, testable, UI-free
│  │  └─ src/
│  │     ├─ leads/    (create+dedupe, stage transitions, import)
│  │     ├─ sequences/ (enrollment, scheduling, channel-selection, pause/stop)
│  │     ├─ messaging/ (send pipeline, merge tags, idempotency, quiet hours)
│  │     ├─ attribution/
│  │     ├─ ai/        (draft-reply service)
│  │     └─ integrations/ (provider interfaces + mocks + real providers)
│  └─ api-client/               # typed fetch client generated from zod contracts; used by web+mobile
```

**Rule that keeps this sane:** `apps/*` contain no business logic. Web API routes and mobile screens both call `packages/core`. Anything that fires from a webhook, a cron tick, a UI action, or the simulator goes through the same core function.

## Environments & modes

| Mode | Ad platforms | PMS | Email/SMS | Purpose |
|---|---|---|---|---|
| `demo` (default dev) | MockAdsProvider | MockPmsProvider | Logged, not delivered | Full product demo; simulator button visible |
| `live` | Real providers where connected, mock elsewhere | Real | Resend/Twilio deliver | Production |

Mode is per-org (`Org.mode`) not per-deploy, so a live org and demo org can coexist.

## Environment variables

```
DATABASE_URL=
SUPABASE_URL=                SUPABASE_ANON_KEY=          SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=              EMAIL_FROM="Taylor <stay@yourdomain.com>"
TWILIO_ACCOUNT_SID=          TWILIO_AUTH_TOKEN=          TWILIO_FROM_NUMBER=
META_APP_ID=                 META_APP_SECRET=            META_VERIFY_TOKEN=
TIKTOK_APP_ID=               TIKTOK_SECRET=
PINTEREST_APP_ID=            PINTEREST_SECRET=
HOSTAWAY_CLIENT_ID=          HOSTAWAY_CLIENT_SECRET=
HOSTFULLY_API_KEY=
CRON_SECRET=                 # jobs/tick auth
APP_URL=                     # for links in emails, OAuth redirects
EXPO_PUSH_ENABLED=true
```

## Key flows (sequence sketches)

**Ad lead capture (Meta):**
`Meta leadgen webhook → /api/webhooks/meta (verify sig) → core/leads.createFromCapture() → dedupe → Lead + LeadEvent(CAPTURED) → core/sequences.autoEnroll(trigger=AD_LEAD_CAPTURED) → instant step sent via core/messaging → push notification → realtime update to web (Supabase realtime) `

**Abandoned inquiry:**
`PMS poller (jobs/tick) or PMS webhook → core/integrations.pms.syncInquiries() → new inquiry → Lead(status NEW, source DIRECT_SITE) + LeadEvent(INQUIRY_STARTED) → after abandonmentWindow with no booking → LeadEvent(INQUIRY_ABANDONED) + autoEnroll(trigger=INQUIRY_ABANDONED)`

**Scheduler tick (every minute):**
`/api/jobs/tick → (1) due ScheduledMessages → send (consent + quiet-hours + idempotency checks) → LeadEvent + advance enrollment, schedule next step; (2) run due pollers (PMS sync, ad-metrics sync); (3) abandonment-window promotions; (4) quote-unaccepted + past-guest trigger scans`

**Inbound reply:**
`Twilio inbound webhook / Resend inbound (or reply-to parsing) → core/messaging.recordInbound() → LeadEvent(REPLIED) → pause enrollment → stage bump (NEW→CONTACTED→ENGAGED rules) → push notification "Maya replied — sequence paused"`

## Testing strategy (MVP-appropriate)

- Unit tests (Vitest) for `packages/core` only — the money paths: dedupe, channel selection, scheduling math, quiet hours, pause/stop rules, merge tags, attribution. Target ~40 tests.
- One Playwright smoke test on web: login → simulate lead → lead appears → open drawer → timeline has capture + scheduled steps.
- No mobile e2e in MVP; mobile is a thin client over the tested API.
