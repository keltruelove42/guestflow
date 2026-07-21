# 03 — Data Model (Prisma / Postgres)

Principles: every table carries `orgId` (multi-tenant-ready); all contact fields on Lead are **optional**; timeline = `LeadEvent` rows (the UI never derives history from anywhere else); scheduled sends are rows, not in-memory timers.

```prisma
// packages/db/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ---------- tenancy & auth ----------
model Org {
  id        String   @id @default(cuid())
  name      String
  mode      OrgMode  @default(DEMO)          // DEMO | LIVE
  timezone  String   @default("America/New_York")
  quietStart Int     @default(21)            // 21:00 local — no automated sends after
  quietEnd   Int     @default(9)             // until 09:00
  abandonmentMinutes Int @default(60)
  users     User[]
  properties Property[]
  leads     Lead[]
  campaigns Campaign[]
  sequences Sequence[]
  integrations Integration[]
  createdAt DateTime @default(now())
}
enum OrgMode { DEMO LIVE }

model User {
  id        String  @id                      // = Supabase auth user id
  orgId     String
  org       Org     @relation(fields: [orgId], references: [id])
  email     String  @unique
  name      String?
  role      Role    @default(OWNER)          // OWNER | MEMBER
  expoPushTokens String[]                    // mobile push targets
  createdAt DateTime @default(now())
}
enum Role { OWNER MEMBER }

// ---------- properties ----------
model Property {
  id        String  @id @default(cuid())
  orgId     String
  org       Org     @relation(fields: [orgId], references: [id])
  name      String
  location  String?
  bedrooms  Int?
  type      PropertyType @default(SHORT_TERM)
  photoUrl  String?
  directBookingUrl String?
  knowledgeBase String?  @db.Text            // FAQ / house rules / amenities → AI assistant
  archived  Boolean @default(false)
  leads     Lead[]
  campaigns Campaign[]
  createdAt DateTime @default(now())
  @@index([orgId, archived])
}
enum PropertyType { SHORT_TERM LONG_TERM BOTH }

// ---------- leads (CRM core) ----------
model Lead {
  id        String  @id @default(cuid())
  orgId     String
  org       Org     @relation(fields: [orgId], references: [id])
  propertyId String?
  property  Property? @relation(fields: [propertyId], references: [id])

  name      String
  email     String?                          // ALL optional by design
  phone     String?                          // E.164 normalized on write
  address   String?
  travelDates String?                        // freeform in MVP ("Oct 9–12", "Move-in Sept 1")
  partySize String?

  source    LeadSource
  campaignId String?
  campaign  Campaign? @relation(fields: [campaignId], references: [id])
  externalRef String?                        // platform lead id / PMS inquiry id (dedupe + idempotency)

  stage     Stage   @default(NEW)
  emailConsent Boolean @default(false)       // set true when email provided via consent-labeled form
  smsConsent   Boolean @default(false)
  emailConsentAt DateTime?
  smsConsentAt   DateTime?
  unsubscribedAt DateTime?                   // email opt-out
  smsStoppedAt   DateTime?                   // replied STOP
  needsAttention Boolean @default(false)     // replied → paused → surfaced on dashboard

  events    LeadEvent[]
  notes     Note[]
  enrollments Enrollment[]
  bookings  Booking[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId, stage])
  @@index([orgId, source])
  @@index([orgId, propertyId])
  @@index([orgId, email])
  @@index([orgId, phone])
  @@unique([orgId, externalRef])
}
enum LeadSource { META TIKTOK PINTEREST DIRECT_SITE WIFI MANUAL IMPORT }
enum Stage { NEW CONTACTED ENGAGED QUOTED BOOKED LOST }

model LeadEvent {
  id        String  @id @default(cuid())
  orgId     String
  leadId    String
  lead      Lead    @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type      LeadEventType
  channel   Channel?                         // for message events
  title     String                           // "Lead captured — Meta instant form"
  body      String? @db.Text                 // message body / details
  meta      Json?                            // campaignId, messageId, provider payload refs…
  occurredAt DateTime @default(now())
  @@index([leadId, occurredAt])
  @@index([orgId, occurredAt])               // powers the activity feed
}
enum LeadEventType {
  CAPTURED INQUIRY_STARTED INQUIRY_ABANDONED
  EMAIL_SENT SMS_SENT EMAIL_SCHEDULED_SKIPPED  // skipped = consent/quiet-hours refusal, audited
  REPLIED AI_REPLY_SENT MANUAL_MESSAGE
  QUOTE_SENT BOOKED LOST_MARKED STAGE_CHANGED
  ENROLLED SEQUENCE_PAUSED SEQUENCE_STOPPED SEQUENCE_COMPLETED
  NOTE_ADDED IMPORTED OPTED_OUT
}
enum Channel { EMAIL SMS }

model Note {
  id String @id @default(cuid())
  orgId String
  leadId String
  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  authorId String?
  text String @db.Text
  createdAt DateTime @default(now())
}

// ---------- campaigns & lead forms ----------
model Campaign {
  id        String @id @default(cuid())
  orgId     String
  org       Org @relation(fields: [orgId], references: [id])
  propertyId String?
  property  Property? @relation(fields: [propertyId], references: [id])
  platform  AdPlatform
  name      String
  status    CampaignStatus @default(DRAFT)
  objective String @default("Lead generation")
  dailyBudgetCents Int
  audience  Json                              // {locations, ageRange, interests[], smartAudiences[]}
  leadForm  Json                              // ordered [{key,label,required}] — name always required
  autoEnrollSequenceId String?
  externalCampaignId String?                  // platform id once launched live
  // synced metrics (poller updates; zeros in demo until simulated)
  spendCents Int @default(0)
  impressions Int @default(0)
  clicks     Int @default(0)
  leadsCount Int @default(0)
  startedAt DateTime?
  leads     Lead[]
  createdAt DateTime @default(now())
  @@index([orgId, status])
}
enum AdPlatform { META TIKTOK PINTEREST }
enum CampaignStatus { DRAFT IN_REVIEW ACTIVE PAUSED ENDED }

// ---------- sequences & automation ----------
model Sequence {
  id        String @id @default(cuid())
  orgId     String
  org       Org @relation(fields: [orgId], references: [id])
  name      String
  trigger   SequenceTrigger
  active    Boolean @default(true)
  steps     SequenceStep[]
  enrollments Enrollment[]
  createdAt DateTime @default(now())
}
enum SequenceTrigger {
  AD_LEAD_CAPTURED        // any ad platform
  INQUIRY_ABANDONED
  QUOTE_UNACCEPTED_48H
  CHECKOUT_PLUS_90D
  MANUAL_ONLY
}

model SequenceStep {
  id        String @id @default(cuid())
  sequenceId String
  sequence  Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  order     Int                               // 0-based
  delayMinutes Int                            // from previous step (0 = instant)
  channel   Channel
  subject   String?                           // email only
  body      String @db.Text                   // supports {{first_name}} {{property}} {{host_name}} {{dates}} {{quote_link}} {{unsub_link}}
  @@unique([sequenceId, order])
}

model Enrollment {
  id        String @id @default(cuid())
  orgId     String
  leadId    String
  lead      Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  sequenceId String
  sequence  Sequence @relation(fields: [sequenceId], references: [id])
  status    EnrollmentStatus @default(ACTIVE)
  currentStep Int @default(0)                 // next step to send
  pausedReason String?                        // "Lead replied", "Manually paused"
  scheduled ScheduledMessage[]
  createdAt DateTime @default(now())
  completedAt DateTime?
  @@index([leadId, status])
  @@unique([leadId, sequenceId, createdAt])   // same sequence re-enrollable later, not concurrently (enforced in core)
}
enum EnrollmentStatus { ACTIVE PAUSED STOPPED COMPLETED }

model ScheduledMessage {
  id        String @id @default(cuid())
  orgId     String
  enrollmentId String
  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  stepId    String
  channel   Channel
  sendAt    DateTime
  status    ScheduledStatus @default(PENDING) // PENDING → SENT | SKIPPED | CANCELED | FAILED
  idempotencyKey String @unique               // `${enrollmentId}:${stepId}`
  attempts  Int @default(0)
  lastError String?
  sentAt    DateTime?
  @@index([status, sendAt])                   // the scheduler's hot query
}
enum ScheduledStatus { PENDING SENT SKIPPED CANCELED FAILED }

// ---------- bookings & attribution ----------
model Booking {
  id        String @id @default(cuid())
  orgId     String
  leadId    String
  lead      Lead @relation(fields: [leadId], references: [id])
  propertyId String?
  amountCents Int?
  bookedAt  DateTime @default(now())
  checkoutAt DateTime?                        // enables CHECKOUT_PLUS_90D trigger
  attributedCampaignId String?
  attributedSequenceId String?
  externalRef String?                         // PMS reservation id
  @@index([orgId, bookedAt])
}

// ---------- integrations ----------
model Integration {
  id        String @id @default(cuid())
  orgId     String
  org       Org @relation(fields: [orgId], references: [id])
  provider  String                            // "meta" | "tiktok" | "pinterest" | "hostfully" | "hostaway" | "stayfi" | "ownerrez" | "lodgify" | "klaviyo" | "twilio" | "stripe"
  status    IntegrationStatus @default(DISCONNECTED)
  credentials Json?                           // encrypted at rest (see 08-integrations.md)
  config    Json?                             // e.g. {accountId, pageId, webhookSubscribed}
  lastSyncAt DateTime?
  lastError String?
  @@unique([orgId, provider])
}
enum IntegrationStatus { DISCONNECTED CONNECTED ERROR }
```

## Notes & rationale

- **Dedupe** (`core/leads`): on create, match existing lead by `orgId` + normalized email OR phone. Match → merge non-null fields into existing lead, append a `CAPTURED`/`INQUIRY_*` event, return existing. `externalRef` uniqueness makes webhook retries idempotent.
- **Consent model:** providing an email/phone through a consent-labeled form sets the respective consent + timestamp. `unsubscribedAt`/`smsStoppedAt` are checked at *send time* (not enrollment time) — a lead who opts out mid-sequence gets remaining steps `SKIPPED` with an audited event.
- **`ScheduledMessage.status='PENDING' AND sendAt <= now()`** is the scheduler's entire work query — keep that index healthy.
- **`LeadEvent` is the activity feed**: dashboard feed = last N events for org ordered by `occurredAt` desc; lead timeline = events for lead + pending `ScheduledMessage`s rendered as "Scheduled next".
- **Freeform `travelDates`** is deliberate for MVP (ad forms return text); structured date parsing is a post-MVP enhancement behind the same field.
- **Seed script** (`packages/db/src/seed.ts`) must reproduce the prototype's demo data: 3 properties, 4 sequences with the exact steps/copy from the prototype, 5 campaigns, 8 leads with rich timelines, activity history. Copy the copywriting verbatim from `prototype/guestflow.html` (`state.sequences`, `state.campaigns`, seed leads).
