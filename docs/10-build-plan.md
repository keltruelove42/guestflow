# 10 — Build Plan (Cursor Milestones)

Work strictly in order — every milestone ends with a runnable app and a demo you can click. Paste each milestone's prompt into Cursor (Composer/agent mode), with this `docs/` folder in the repo. After each milestone, run the acceptance checks yourself before moving on.

**Estimated shape:** M0–M3 ≈ the working product in demo mode. M4–M5 ≈ mobile. M6 ≈ first live integrations. M7 ≈ hardening.

---

## M0 — Scaffold & foundations

**Prompt:**
> Read docs/02-architecture.md and docs/03-data-model.md. Create the monorepo exactly as specified: pnpm workspaces + Turborepo; apps/web (Next.js 14 App Router, TS, Tailwind, shadcn/ui, TanStack Query); apps/mobile (Expo + expo-router + NativeWind, placeholder screens); packages/shared (zod schemas + enums + design tokens from docs/06-web-app.md), packages/db (Prisma schema verbatim from docs/03-data-model.md + seed script reproducing the demo data described there, copying copy from docs/prototype/guestflow.html), packages/core (empty module folders + interfaces from docs/08-integrations.md), packages/api-client (typed fetch wrapper). Add Supabase auth to web (magic link + Google) with the post-login org bootstrap from docs/06-web-app.md. Vitest wired for packages/core.

**Accept:** `pnpm dev` runs web; login works; `pnpm db:seed` populates; `pnpm test` green (even if few tests); mobile boots to tab placeholders.

## M1 — CRM core (leads, properties, timeline)

**Prompt:**
> Implement per docs/04-api-spec.md and docs/06-web-app.md: properties CRUD + /properties page; leads API (list/detail/create/patch/stage/notes, dedupe per docs/03-data-model.md notes) in packages/core with unit tests; /leads page with stage tabs, source filter, global property filter, table, and the lead drawer exactly as described (contact block with "not provided (optional)", consent line, actions row, timeline from LeadEvents + scheduled placeholders, notes). Add lead modal + CSV import. Design tokens + dark mode per docs/06-web-app.md. Match docs/prototype/guestflow.html visually.

**Accept:** Seeded leads browse/filter correctly; drawer matches prototype; stage change writes timeline events; CSV import round-trips; dedupe unit tests pass.

## M2 — Automation engine + simulator

**Prompt:**
> Implement docs/05-automation-engine.md completely in packages/core/src/sequences and messaging: triggers, autoEnroll, resolveChannel with fallback, ScheduledMessage scheduling, /api/jobs/tick with the four phases and all send-time guards (consent, quiet hours defer, idempotency, demo-mode logging senders), pause/stop rules, merge-tag renderer. Sequences API + /sequences page per docs/06-web-app.md with form-based editor. Simulator endpoints per docs/04-api-spec.md + the ⚡ Simulate button in the web top bar. Webhook route shells that the simulator posts to. Write the full unit-test checklist from docs/05-automation-engine.md.

**Accept:** Clicking Simulate creates a lead through the webhook path, enrolls it, sends the instant step (logged), timeline shows sent + scheduled; `/simulate/tick` advances a sequence end-to-end; reply simulation pauses + flags attention; all engine unit tests pass.

## M3 — Campaigns, dashboard, integrations hub (demo-complete)

**Prompt:**
> Implement per docs/06-web-app.md: campaigns API + page + 4-step wizard with lead-form builder and live preview (docs/prototype/guestflow.html is the reference); MockAdsProvider metrics drift per docs/08-integrations.md; dashboard endpoints + page with the 4 KPI tiles, the stacked weekly SVG chart (follow the chart spec: fixed source colors, 2px gaps, rounded stack tops, totals labeled, hover tooltip, legend), source bars, activity feed, needs-attention list; integrations page with all provider cards, connect modals storing encrypted credentials, mock statuses. Supabase realtime → query invalidation + capture toasts.

**Accept:** Full prototype parity in the real app: wizard launches a demo campaign whose metrics move; dashboard numbers derive from real rows; integration connect/disconnect persists; the whole demo flow (simulate → CRM → sequence → reply → attention → booked → attribution KPIs) works.

## M4 — Mobile app core

**Prompt:**
> Build apps/mobile per docs/07-mobile-app.md: auth, tab navigation, Home (KPIs, attention, activity), Leads list + lead detail mirroring the web drawer, compose screen, campaigns/sequences read+toggle screens, More tab. Use packages/api-client for all data; NativeWind with shared tokens; pull-to-refresh; property chip filter.

**Accept:** Log in on device/simulator; browse seeded data; change a stage and see it on web instantly; send a manual message from mobile → timeline updates both ends.

## M5 — Push notifications + AI assistant

**Prompt:**
> Implement Expo push per docs/07-mobile-app.md (token registration endpoint, core notifications service fired on capture/reply/booking, collapse rule, deep links, per-user toggles). Implement the AI assistant per docs/09-ai-assistant.md (core service, API endpoint, web drawer card, mobile card + composer prefill, guardrails, KB banner). Add knowledgeBase textarea to property forms.

**Accept:** Simulated capture pings the phone and deep-links to the lead; AI drafts respect the KB (test: ask about something not in KB → draft says it will check); Use-draft-send pauses the sequence.

## M6 — First live integrations

**Prompt:**
> Wire live providers per docs/08-integrations.md behind the existing interfaces, in this order: (1) Resend live email with unsubscribe links + inbound reply-to routing + webhook; (2) Twilio SMS out/in with STOP handling; (3) Meta OAuth + leadgen webhook + fetchLead + metrics sync (campaign creation can remain create-in-Meta-and-link if Marketing API review is pending); (4) Hostfully or Hostaway (whichever credentials exist) inquiry+booking polling with property mapping UI. Keep demo mode fully working; live/demo is per-org mode.

**Accept:** A real test lead from a Meta test form lands in the CRM and gets a real email; replying by SMS pauses the sequence; a PMS test inquiry auto-enrolls after the abandonment window; org in DEMO mode still simulates everything.

## M7 — Hardening & launch checklist

**Prompt:**
> Add: Playwright smoke test (login → simulate → drawer assertions); rate limiting on public webhooks; Sentry (web+mobile+api); empty/loading/error states audit against docs/06-web-app.md; a /settings page (org name, timezone, quiet hours, abandonment window, send mode); EAS build profiles; Vercel deploy config with cron; README quickstart.

**Accept:** Smoke test green in CI; deployed web + installable mobile build; settings persist and the engine respects them.

---

## Standing guidance for every milestone

- The prototype (`docs/prototype/guestflow.html`) settles visual/behavioral questions; these docs settle logic questions. When neither covers it, choose the simplest option and leave a `// DECISION:` comment.
- Business logic goes in `packages/core` with a unit test — never in routes/components.
- Every automated action writes a `LeadEvent`. If a feature doesn't show up in the timeline, it didn't happen.
- Compliance invariants (docs/05 §Compliance) are non-negotiable in every milestone that touches sending.
- Keep the seed data working; it's the demo, the test fixture, and the sales pitch.
