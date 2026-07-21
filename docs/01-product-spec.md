# 01 — Product Spec (PRD)

## Vision

Rental operators lose most of their potential guests twice: once at the top of the funnel (people who see an ad, are interested, but never make it to a booking page) and once at the bottom (people who inquire on a direct-booking site and abandon before paying). GuestFlow captures both groups' contact information — with every field optional so capture converts — and turns them into direct bookings with automated, compliant, multi-channel follow-up. Think **StayFi + HubSpot + yada.ai**, purpose-built for short- and long-term rentals, integrating with PMSs like **Hostfully and Hostaway** instead of replacing them.

## Users

- **Primary (MVP): Owner-operator** (the founder's own portfolio). 1–15 properties, mix of short-term and long-term. Runs their own ads or wants to. Lives on their phone.
- **Secondary (post-MVP): Other hosts / small property managers** — the schema is multi-tenant (every row carries `orgId`) so this becomes a SaaS without a rewrite.

## Success criteria for the MVP

The MVP is done when a user can: connect (or mock-connect) an ad account and a PMS; launch a lead campaign with a custom instant form; watch leads arrive in the CRM in real time (simulated or real); see every lead auto-enrolled in the right follow-up sequence; get a push notification on their phone when a lead replies; send an AI-drafted reply; mark the lead booked and see revenue attributed — all across multiple properties.

---

## Features

Stages everywhere: `NEW, CONTACTED, ENGAGED, QUOTED, BOOKED, LOST`.
Sources everywhere: `META, TIKTOK, PINTEREST, DIRECT_SITE, WIFI, MANUAL, IMPORT`.

### F1 — Multi-property foundation

**Stories**
- As an operator I manage several rentals (short- and long-term); every lead, campaign, sequence and report is scoped to a property, with an "all properties" rollup.
- As an operator I can add/edit/archive properties (name, location, bedrooms, type `SHORT_TERM | LONG_TERM | BOTH`, photo, direct-booking URL, FAQ/house-rules text used by the AI).

**Acceptance**
- Global property filter in web top bar and mobile header; persists per session; every list and KPI respects it.
- Property CRUD; archiving hides from filters but keeps history.

### F2 — Lead capture from ads (Meta / TikTok / Pinterest)

**Stories**
- As an operator I create a lead campaign in a 4-step wizard: platform → audience → budget/schedule → instant lead form.
- The lead form has **name required; email, phone, address, travel dates, party size optional** (optional fields keep completion high). Consent copy is shown at capture; submitting grants channel consent for the channels provided.
- Each campaign selects which sequence new leads auto-enroll in (default: "New Ad Lead Welcome").
- Leads arrive via platform webhook/polling and appear in the CRM within seconds, attributed to campaign + platform, with their first sequence step already sent or scheduled.

**Acceptance**
- Wizard identical in structure to prototype (see `06-web-app.md` §Campaigns); works with `MockAdsProvider` in demo mode and `MetaAdsProvider` in live mode.
- Campaign cards show status (Draft/In review/Active/Paused), spend, leads, cost-per-lead; pause/resume/launch actions.
- A lead submitting only name+phone gets an SMS-first path; only name+email gets email-first (see `05-automation-engine.md` §Channel selection).
- Smart audiences listed in the wizard (abandoned-inquiry lookalike, site-visitor retargeting, past-guest lookalike) — in MVP these are labeled options that map to saved platform audiences; creating them is a stub.

### F3 — Abandoned-inquiry capture from direct booking sites

**Stories**
- As an operator, when someone inquires or starts a booking on my Hostfully/Hostaway/OwnerRez/Lodgify direct site and doesn't complete it, GuestFlow captures whatever contact info the form collected and creates a lead with source `DIRECT_SITE`.
- Abandonment window is configurable (default **60 min**): if the PMS shows no confirmed booking for that inquiry within the window, the lead is auto-enrolled in "Abandoned Inquiry Rescue".
- If the person later books (via any channel the PMS sees), the sequence stops automatically.

**Acceptance**
- `MockPmsProvider` simulates inquiries + occasional conversions for demo mode; `HostfullyProvider`/`HostawayProvider` implement the same interface (see `08-integrations.md`).
- De-dupe on (normalized email) OR (normalized phone) per org: an existing lead gets a new `INQUIRY_ABANDONED` event instead of a duplicate lead.

### F4 — CRM

**Stories**
- As an operator I see all leads in a filterable table (stage tabs with counts, source filter, property filter) sorted by recency.
- Lead detail shows: all-optional contact fields (missing ones shown as "not provided (optional)"), consent per channel, source + campaign attribution, dates/party, full timeline (past events + scheduled future sends), notes, and actions: change stage, enroll in sequence, send manual email/SMS, add note.
- Marking `BOOKED` stops any active sequence and records a booking (amount optional) for attribution.
- I can add leads manually and import CSV (map columns → fields; de-dupe on email/phone).

**Acceptance**
- Matches prototype drawer exactly (web) / lead screen (mobile). Stage change, enrollment, manual sends and notes all write `LeadEvent` rows and render in the timeline instantly.
- CSV import: preview first 5 rows, column mapping UI, import report (created / merged / skipped).

### F5 — Automated follow-up sequences (email + SMS)

**Stories**
- As an operator I have 4 pre-seeded sequences — Abandoned Inquiry Rescue, New Ad Lead Welcome, Quote Sent No Booking, Past Guest Re-engagement — and can edit steps (delay, channel, subject/body with `{{merge_tags}}`) in a form-based editor, activate/pause sequences, and create new ones from templates.
- Sequences start automatically from triggers (see `05-automation-engine.md`): lead captured from ad, inquiry abandoned, quote unaccepted 48h, checkout + 90d.
- A reply on any channel **pauses** the enrollment and flags the lead ("Needs your attention"); booking or opt-out **stops** it.
- Sequence cards show enrolled / reply-rate / attributed bookings.

**Acceptance**
- Engine behavior per `05-automation-engine.md` incl. quiet hours (default 9pm–9am lead-local, fallback org-local), consent enforcement, `STOP` handling for SMS, unsubscribe links in every email.
- In demo mode sends are simulated (logged, not delivered) but timeline + stats behave identically; a `SEND_MODE=live` flag enables Resend/Twilio.

### F6 — AI reply assistant (yada.ai-style)

**Stories**
- On any lead, GuestFlow drafts a reply using: the conversation thread, lead fields, and the property's knowledge base (FAQ, house rules, amenities, rates notes).
- I can edit, regenerate, or send the draft (send = manual message through normal send path; pauses any active sequence).

**Acceptance**
- Per `09-ai-assistant.md`: Claude API, structured prompt, guardrails (never invents availability or prices unless present in KB; falls back to "I'll check and confirm").
- Draft latency target < 4s; drafts are never auto-sent in MVP.

### F7 — Dashboard & attribution

**Stories**
- KPIs: new leads (30d, with delta), blended cost-per-lead, follow-up reply rate, recovered bookings + attributed revenue.
- Charts: stacked weekly new-leads by source (8 weeks); leads-by-source all-time bars. (Chart specs + palette in `06-web-app.md` §Dashboard.)
- Recent activity feed (automation log) and "Needs your attention" list (paused enrollments awaiting human reply).
- Attribution: a booking is attributed to the lead's source campaign and any sequence whose message preceded the booking within 30 days (last-touch within window; simple and explainable).

### F8 — Integrations hub

**Stories**
- Cards for: Meta Lead Ads, TikTok Lead Gen, Pinterest Ads, Hostfully, Hostaway, StayFi, OwnerRez, Lodgify, Klaviyo, Twilio, Stripe — each with connect/disconnect (OAuth or API-key), status, last-sync time, and error surface.

**Acceptance**
- Provider interface per `08-integrations.md`; every provider ships with a mock. StayFi = in-stay WiFi email capture → imports guests as leads with source `WIFI` feeding the re-engagement sequence. Klaviyo = optional mirror of email sends + audience sync (stub acceptable in MVP if events are queued).

### F9 — Phone app (companion)

**Stories**
- As an operator on the go I get push notifications for: new lead captured, lead replied (sequence paused), booking recorded.
- I can: view dashboard KPIs + activity, browse/filter leads, open a lead (full timeline), change stage, enroll in sequence, send AI-drafted or manual replies, pause/resume campaigns and sequences.
- Campaign *creation* and sequence *editing* stay web-only in MVP (deep links open the web app).

**Acceptance**
- Per `07-mobile-app.md`. Expo push notifications tap through to the relevant lead. All reads/writes go through the same REST API as web.

### F10 — Demo mode / lead simulator

**Stories**
- A "Simulate incoming lead" action (dev + demo builds; header button on web, hidden dev menu on mobile) generates a realistic lead through the *real* capture pipeline (webhook handler → CRM → enrollment → first send), so the entire system is demonstrable without live integrations.

**Acceptance**
- Simulator hits the same `/webhooks/*` endpoints external platforms would. No special-case writes.

---

## Non-functional requirements

- **Compliance:** consent recorded per channel with timestamp+source; SMS only with `smsConsent` and full TCPA hygiene (`STOP/HELP` handling, quiet hours, sender identification); every marketing email has unsubscribe; deleting a lead hard-deletes contact fields (GDPR/CCPA-friendly).
- **Performance:** lead list < 300ms for 10k leads (indexed, paginated); webhook→CRM visibility < 5s; scheduler tick ≤ 60s granularity.
- **Reliability:** all sends idempotent (idempotency key = enrollmentId+stepId); webhook handlers verify signatures and are safe to retry.
- **Auditability:** every automated action writes a `LeadEvent`; the activity feed is a query, not a separate log.
- **Multi-tenant-ready:** every table carries `orgId`; all queries scoped by it from day one; auth sessions carry org.
