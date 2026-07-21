# 07 — Mobile App (Expo / React Native)

`apps/mobile` — a **companion app**: monitor, respond, and manage on the go. Heavy authoring (campaign wizard, sequence editor) stays on web; the app deep-links there when needed. TypeScript, expo-router, NativeWind, TanStack Query, same `packages/api-client` + `packages/shared` as web.

## Navigation

```
(auth)/login                     — Supabase magic link / Google (expo-auth-session)
(tabs)/
  index        "Home"            — KPIs + activity + attention
  leads        "Leads"           — searchable, filterable list
  campaigns    "Campaigns"       — cards, pause/resume
  sequences    "Follow-ups"      — cards, activate/pause
  more         "More"            — properties, integrations status, settings, logout
lead/[id]                        — full lead screen (modal stack)
compose?leadId=&draft=           — message composer (email/SMS, AI draft prefilled)
```

Property filter: horizontal chip row under each tab header (`All · Blue Ridge Lakehouse · …`), same URL-param semantics as web.

## Screens

### Home
- KPI 2×2 grid (same 4 tiles as web dashboard; big numbers, delta captions).
- "Needs your attention" section first when non-empty — replied leads with a **Reply** button that jumps straight to composer with AI draft loading.
- Activity feed (icon + text + relative time), pull-to-refresh, live update on push receipt.
- Demo builds: "Simulate lead" in a dev menu (long-press on logo).

### Leads
- Search bar (name/email/phone) + stage chips + source filter sheet.
- Row: name, best-contact line, source pill, stage dot, sequence "step 2/4", relative time. Infinite scroll.
- Row tap → `lead/[id]`.

### Lead detail (`lead/[id]`)
Mirror of the web drawer, vertically stacked: contact card (tap phone → call/SMS intents, tap email → mail intent; "not provided (optional)" placeholders) · consent line · stage segmented control · actions (Enroll in sequence…, Send email, Send SMS) · **AI assistant card** (draft, Use draft → opens composer prefilled, Regenerate) · timeline incl. "Scheduled next" ⏳ items · notes with quick-add.

### Compose
Channel toggle (Email/SMS — disabled if no consented target), subject (email), body, merge-tag chips, character counter for SMS, send → `POST /leads/:id/messages` (marks `viaAi` when the draft was used). Sending pauses any active enrollment (server-side rule) — show the resulting toast.

### Campaigns / Follow-ups
Read + toggle: same cards as web (compact), Pause/Resume/Activate actions, stats strips. "Create campaign" / "Edit sequence" buttons open the web app URL.

### More
Properties (list + add basic), Integrations (status list, tap → web), Settings: notification toggles per event type, quiet-hours display, org mode badge, sign out.

## Push notifications (Expo Notifications)

Registration: on login, get Expo push token → `POST /devices`. Server sends via Expo push API (`packages/core/src/notifications.ts`), fired by the same core events:

| Event | Notification | Tap → |
|---|---|---|
| Lead captured | "⚡ New lead: Hannah Cole via Meta — Blue Ridge Lakehouse" | `lead/[id]` |
| Lead replied (sequence paused) | "💬 Maya Thompson replied — follow-up paused for you" | `lead/[id]` (composer CTA) |
| Booking recorded | "✅ Aisha Bell booked — $1,260 attributed to Fall Lake Getaway" | `lead/[id]` |
| Sequence completed w/o reply (daily digest, optional) | "3 sequences completed yesterday, 1 reply" | Home |

Rules: respect per-user toggles; collapse bursts (>3 captures in 5 min → single "4 new leads" notification); deep links via expo-router linking config; badge count = attention count.

## Mobile-specific implementation notes

- Auth: `supabase-js` with `expo-secure-store` persistence; API client attaches the session JWT.
- Offline: TanStack Query cache persisted to AsyncStorage — read-only offline is fine; mutations require network (queue not needed in MVP).
- Realtime: rely on push + refetch-on-focus rather than a persistent socket.
- Design tokens shared from `packages/shared/src/constants/tokens.ts` (the same hexes as web, incl. dark mode via `useColorScheme`).
- EAS: `eas.json` with `development`, `preview` (internal TestFlight/APK), `production` profiles; OTA updates via `expo-updates` for JS-only changes.
