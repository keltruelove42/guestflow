# 06 — Web App

`apps/web`, Next.js App Router + Tailwind + shadcn/ui + TanStack Query. **The prototype (`prototype/guestflow.html`) is the design source of truth** — replicate its layout, information hierarchy, copy tone, and interactions. This doc lists what each route contains and where behavior differs from the prototype (i.e., where it becomes real).

## Design tokens (from the prototype — port into `tailwind.config` / CSS vars)

```
Light: page #f9f9f7 · surface #fcfcfb · surface-2 #f0efec · ink #0b0b0b · ink-2 #52514e
       muted #898781 · grid #e1e0d9 · border rgba(11,11,11,.10) · accent #2a78d6
Dark:  page #0d0d0d · surface #1a1a19 · surface-2 #242422 · ink #ffffff · ink-2 #c3c2b7
       grid #2c2c2a · border rgba(255,255,255,.10) · accent #3987e5
Series (light): s1 #2a78d6 s2 #eb6834 s3 #1baf7a s4 #eda100 s5 #e87ba4 s6 #008300 s7 #4a3aa7 s8 #e34948
Series (dark):  s1 #3987e5 s2 #d95926 s3 #199e70 s4 #c98500 s5 #d55181 s6 #008300 s7 #9085e9 s8 #e66767
Status: good #0ca30c · warn #fab219 · serious #ec835a · critical #d03b3b · good-text(light) #006300
Font: system-ui stack. Radius: cards 14px, buttons/inputs 8px, pills 99px. Dark mode: prefers-color-scheme.
```

Source colors are **fixed per source** (never reassigned by rank): META→s1, TIKTOK→s2, DIRECT_SITE→s3, PINTEREST→s4, WIFI→s5, MANUAL→s7. Stage dots: NEW s1, CONTACTED s2, ENGAGED s5, QUOTED s4, BOOKED good, LOST muted.

## Shell

Sidebar (Dashboard, Leads, Ad Campaigns, Follow-ups, Properties, Integrations — with live count badges) + top bar (page title, global property `<Select>`, and in demo mode the **⚡ Simulate incoming lead** button). Property filter stored in URL search param (`?property=`) so it survives refresh and is shareable. Realtime: subscribe (Supabase realtime) to `LeadEvent` inserts for the org → invalidate affected queries → toast for capture events ("⚡ Hannah Cole just came in via Meta…").

## `/dashboard`

Exactly the prototype layout:
1. **4 stat tiles** from `GET /dashboard/kpis` — new leads 30d (+delta), blended cost/lead, follow-up reply rate (+enrolled all-time), recovered bookings (+attributed revenue in `good-text`).
2. **New leads per week** — stacked bar chart, 8 weeks, sources META/TIKTOK/DIRECT/PINTEREST stacked in that fixed order (s1/s2/s3/s4). Build as inline SVG exactly like the prototype: 2px surface-colored gaps between segments, 4px rounded top of each stack, total count labeled above each bar, hairline gridlines, legend row above, hover tooltip with per-source values + total (crosshair hit area = full column width). No chart library needed.
3. **Leads by source** — horizontal bars, entity-colored, value right-aligned.
4. **Recent activity** — `GET /activity`, icon + rich text + relative time.
5. **Needs your attention** — `GET /attention`, each row opens the lead drawer; per prototype ("automation paused → human reply").

## `/leads`

- Stage tabs (`All` + 6 stages with counts) + source select + **＋ Add lead** + **⬆ Import CSV**.
- Table columns: Lead (name + best contact under), Source pill, Property, Dates/need, Stage pill, Follow-up sequence (name + step x/y), Added (relative). Row click → drawer. Paginated (infinite scroll).
- Footer note (verbatim from prototype): "Every contact field is optional at capture — GuestFlow picks the best follow-up channel from whatever it has…"
- **Lead drawer** (right sheet, ~560px — shadcn `Sheet`): header (name, source/stage/property/sequence pills) · contact block with "not provided (optional)" placeholders + consent line (✅/🚫 per channel) + campaign attribution · actions row (stage select, enroll-in-sequence select, Send email / Send SMS buttons — disabled without consented channel) · **AI reply assistant card** (accent border, draft text, Use draft → send / ↻ Regenerate, caption "trained on your property FAQ & house rules") · Timeline (past events desc; then "Scheduled next" section rendering pending ScheduledMessages at 65% opacity with ⏳ timestamps) · Notes (list + add input).
- **Add lead modal** and **CSV import modal** (upload → header-row mapping table → preview 5 rows → import → result summary).

## `/campaigns`

- Intro line + **＋ New campaign** (primary).
- Card grid per prototype: platform pill, status pill (dot color: Active good / Paused serious / Draft muted / In review warn), name, property + $X/day, Audience summary line, 3-stat strip (Spend / Leads / Cost-per-lead) on surface-2, actions (Pause/Resume/Launch + 👁 Lead form preview modal).
- **New campaign wizard** — 4-step modal, step progress bars on top, identical structure to prototype:
  1. Platform cards (Meta/TikTok/Pinterest with subtitles) + property select + campaign name.
  2. Audience: locations input, age range, interest chips (toggle), "Smart audiences" chip row (abandoned-inquiry lookalike ✓, site-visitor retargeting ✓, past-guest lookalike).
  3. Budget: daily budget input + live estimated leads/week + CPL range (use the prototype's formula as placeholder heuristic; note it's an estimate), schedule select.
  4. Lead form builder: field toggle chips (Full name required-locked; Email, Phone, Address, Travel dates, Party size optional) + **live phone-frame form preview** (title "get rates & availability", required/optional tags, consent copy, CTA) + "On submit, enroll in" sequence select.
  - Launch → `POST /campaigns` then `/launch`. Demo: toast explains simulated review→active. Live: shows IN_REVIEW status from provider.

## `/sequences`

- Intro line ("Follow-ups start automatically… Replies pause the sequence…") + **＋ New sequence**.
- Cards per prototype: name + channel pill, Active/Paused pill + trigger line, 3-stat strip (Enrolled / Replies+% / Booked in good-text), vertical step list with connector line — per step: icon (✉️/💬), "WAIT 3 DAYS · EMAIL" delay caption, title, body preview.
- **Editor modal** (form-based MVP, not drag-drop): name, trigger select, step rows (delay value+unit, channel, subject, body textarea with merge-tag helper chips), add/remove/reorder steps, validation (first-SMS STOP warning, email unsub auto-append notice). Editing warns: "future scheduled sends will be recomputed."

## `/properties`

Cards per prototype (emoji/photo, name, location · BR, type pill, N leads pill, N active ads pill, "View leads →" which sets the property filter and navigates). Add/edit modal incl. **knowledge base textarea** ("FAQ, house rules, amenities — the AI assistant uses this") and direct booking URL.

## `/integrations`

Card grid per prototype: brand-colored icon tile, name, 2-line description, Connected/Not-connected pill, Connect/Disconnect button. Real behavior: Connect → API-key modal (Hostfully, StayFi) or OAuth redirect (Meta, TikTok, Pinterest, Hostaway, Klaviyo, Stripe) or credential form (Twilio SID/token/number). Connected cards show last-sync time and surface `lastError` with a Retry/sync-now button.

## `/login`

Supabase magic-link + Google. Post-login bootstrap: if user has no org, create org + seed demo data (mode DEMO) — first-run experience is the populated prototype state, exactly like opening the HTML file.

## States to build deliberately

Loading skeletons per card/table; empty states with a CTA (no leads → "Launch your first campaign or simulate a lead"); error toasts on mutation failure with retry; optimistic updates for stage change, notes, pause/resume.
