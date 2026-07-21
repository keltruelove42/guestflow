# 05 — Automation Engine (Follow-up Sequences)

The heart of the product. Everything here lives in `packages/core/src/sequences` and `packages/core/src/messaging`, is pure TypeScript over Prisma, and is unit-tested. No business rule below may live in a UI layer or an API route.

## Triggers → auto-enrollment

| Trigger | Fired by | Default sequence (seeded) |
|---|---|---|
| `AD_LEAD_CAPTURED` | webhook handler after lead create, when source ∈ {META, TIKTOK, PINTEREST} | New Ad Lead Welcome |
| `INQUIRY_ABANDONED` | scheduler phase 3: inquiry lead with no booking after `org.abandonmentMinutes` | Abandoned Inquiry Rescue |
| `QUOTE_UNACCEPTED_48H` | scheduler phase 4: `QUOTE_SENT` event ≥48h old, stage still `QUOTED` | Quote Sent, No Booking |
| `CHECKOUT_PLUS_90D` | scheduler phase 4: booking `checkoutAt` +90d | Past Guest Re-engagement |
| `MANUAL_ONLY` | user action only | — |

`autoEnroll(lead, trigger)` rules:
1. Find org's **active** sequences with this trigger. Campaign override: if the lead's campaign has `autoEnrollSequenceId`, that wins for `AD_LEAD_CAPTURED`.
2. Skip if lead already has an ACTIVE or PAUSED enrollment in that sequence, or stage ∈ {BOOKED, LOST}.
3. Create `Enrollment(currentStep=0)` + `LeadEvent(ENROLLED)`.
4. Schedule step 0: `sendAt = now + step[0].delayMinutes` (0 ⇒ immediate, still via the queue for uniformity — tick picks it up within a minute; for the "instant welcome" feel, `autoEnroll` may call `processScheduledMessage` inline when `delayMinutes === 0`).

## Channel selection & fallback (the "all fields optional" payoff)

For each step at **send time**:

```
resolveChannel(step, lead):
  wants = step.channel
  emailOk = lead.email && lead.emailConsent && !lead.unsubscribedAt
  smsOk   = lead.phone && lead.smsConsent && !lead.smsStoppedAt
  if wants == EMAIL: return emailOk ? EMAIL : (smsOk ? SMS_FALLBACK : SKIP)
  if wants == SMS:   return smsOk   ? SMS   : (emailOk ? EMAIL_FALLBACK : SKIP)
```

- Fallback rewrites the content: SMS→EMAIL uses the step body as the email body with a generic subject ("A note about {{property}}"); EMAIL→SMS truncates body to 300 chars + link. Mark event meta `{fallbackFrom}`.
- `SKIP` writes `LeadEvent(EMAIL_SCHEDULED_SKIPPED, "No consented channel available")`, sets `ScheduledMessage.status=SKIPPED`, and **still advances** the enrollment (never wedge a sequence on a missing field).
- A lead with phone-only + smsConsent therefore rides an email-designed sequence entirely over SMS — this is the prototype's "SMS-first path chosen automatically" behavior.

## The scheduler tick (every 60s, idempotent, concurrency-safe)

```
tick():
  1. SENDS: claim due messages (status=PENDING, sendAt<=now, FOR UPDATE SKIP LOCKED, limit 100)
     for each: guard → render → send → record → advance
  2. POLLERS: for each CONNECTED integration whose pollInterval elapsed → provider.sync()
  3. ABANDONMENT: leads source=DIRECT_SITE with INQUIRY_STARTED but no INQUIRY_ABANDONED/booking,
     older than org.abandonmentMinutes → write INQUIRY_ABANDONED + autoEnroll
  4. TIME TRIGGERS: QUOTE_UNACCEPTED_48H and CHECKOUT_PLUS_90D scans (cheap indexed queries)
```

**Guards, in order, per send** (each failure → SKIPPED + audited event; guards are individually unit-tested):
1. Enrollment still ACTIVE (not paused/stopped since scheduling)
2. Sequence still active; org not suspended
3. Lead stage ∉ {BOOKED, LOST}
4. Channel resolution (above) — consent & contact presence
5. **Quiet hours**: if lead-local time (fallback: org tz) within `quietStart–quietEnd`, don't skip — **defer**: `sendAt = next quietEnd`, status stays PENDING
6. **Idempotency**: `idempotencyKey` unique; sender APIs called with it where supported
7. **Demo mode**: render fully, write events, mark SENT — but sender is the logging mock

**After a successful send:** `LeadEvent(EMAIL_SENT|SMS_SENT)` with rendered body → `enrollment.currentStep++` → if more steps: create next `ScheduledMessage(sendAt = sentAt + nextStep.delayMinutes)`; else `EnrollmentStatus=COMPLETED` + event. Stage side-effect: a first outbound touch on a `NEW` lead bumps to `CONTACTED`.

## Pause / stop rules

| Event | Effect |
|---|---|
| Inbound reply (SMS webhook, email reply) | Active enrollments → `PAUSED("Lead replied")`; pending messages stay PENDING but guard 1 holds them; `needsAttention=true`; stage bump NEW/CONTACTED→ENGAGED; push notification |
| Manual/AI message sent by user | Same pause (user has taken over the conversation) |
| Stage → BOOKED (manual or PMS-synced) | Enrollments → `STOPPED`; pending → CANCELED; `LeadEvent(SEQUENCE_STOPPED, "Booked")`; attribution runs |
| Stage → LOST | Enrollments → `STOPPED` |
| SMS `STOP` | `smsStoppedAt=now`, confirmation SMS (carrier-required), `OPTED_OUT` event; email steps may continue if consented |
| Email unsubscribe link | `unsubscribedAt=now`, `OPTED_OUT` event; SMS steps may continue if consented |
| User resumes a paused enrollment | Status ACTIVE; next pending message's `sendAt = max(sendAt, now + 1h)` (don't dogpile right after a conversation) |

## Merge tags

Rendered by `core/messaging/render.ts` (unit-tested, HTML-escaped where relevant):
`{{first_name}}` (first token of name, fallback "there"), `{{name}}`, `{{property}}` (fallback "our place"), `{{host_name}}` (org owner's name), `{{dates}}` (fallback "your dates"), `{{quote_link}}` (property.directBookingUrl fallback APP_URL), `{{unsub_link}}` (required in every EMAIL body; renderer appends footer automatically if missing), `{{season}}` (computed from send date). Unknown tags render empty + log warning.

## Compliance invariants (test these explicitly)

1. No SMS ever sent without `smsConsent && !smsStoppedAt`. No email without `emailConsent && !unsubscribedAt`.
2. Every marketing email contains a working unsubscribe link (renderer-enforced).
3. Every automated SMS ≤ 320 chars, identifies sender on first touch ("It's {{host_name}} from {{property}}"), and the sequence's first SMS includes "(Reply STOP to opt out)" — the seeded copy already does; the editor warns if a first SMS step lacks it.
4. Quiet hours defer, never drop.
5. Consent timestamps + capture source stored (form consent copy version in `LeadEvent(CAPTURED).meta`).

## Seeded sequences

Seed exactly the 4 sequences from the prototype — same names, triggers, step order, delays (Instant/1h/1d/2d/3d/4d/7d/10d/90d/180d → minutes), channels, and body copy (source: `prototype/guestflow.html`, `state.sequences`). They're good copy and they make the demo land.

## Unit-test checklist (Vitest, `packages/core`)

- autoEnroll: happy path, campaign override, dedupe against active enrollment, stage guards
- resolveChannel: 8 combinations of {email?, phone?} × {consents}; fallback content rewrites
- tick: claims only due+pending; concurrent tick double-run sends once (idempotency)
- quiet hours: 8:59pm sends, 9:01pm defers to 9:00am, tz respected
- pause on reply mid-sequence; resume pushes sendAt
- BOOKED cancels pending; STOP blocks SMS but not email
- merge tags: fallbacks, unsub enforcement, escaping
- abandonment promotion at exactly the window boundary
