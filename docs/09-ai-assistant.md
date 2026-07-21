# 09 — AI Reply Assistant

yada.ai-style drafting, scoped tightly for MVP: **draft, never auto-send**. Lives in `packages/core/src/ai/draftReply.ts`, exposed via `POST /leads/:id/ai-draft`, rendered in the web drawer + mobile lead screen.

## Inputs assembled per draft

1. **Property knowledge base** — `Property.knowledgeBase` freeform text (FAQ, house rules, amenities, parking, pets, dock, check-in, rate notes). Edited on the property form ("The AI assistant answers from this — keep it current").
2. **Lead context** — name, stage, source, travelDates, partySize, campaign name, property name/type.
3. **Conversation thread** — last 15 `LeadEvent`s of message/reply/note types, rendered as a transcript (who/when/channel/body).
4. **Org voice** — host name, sign-off, direct-booking value prop ("direct saves ~12–15% vs platforms"), org-configurable snippet later.

## Claude API call

Model: `claude-sonnet-4-5` (fast/cheap enough per draft; make it an env var `AI_MODEL`). Single-turn `messages.create`, `max_tokens: 400`, system prompt:

```
You draft replies that a rental host sends to potential guests. Write as {{host_name}},
warm, concise (60–120 words), plain text, first person, no emojis unless the guest used them.
End with "— {{host_name}}".

Hard rules:
- Use ONLY facts present in the PROPERTY KNOWLEDGE BASE and THREAD. If the guest asks
  something not covered (availability, exact pricing, specific amenities), do NOT invent —
  say you'll check and confirm shortly.
- Never promise discounts or hold dates unless the knowledge base authorizes it.
- If dates are known and the KB includes a direct booking link, invite them to book direct.
- If the guest sounds ready to book, propose the concrete next step (quote link / booking link).
- If the last inbound message asks multiple questions, answer each briefly in order.
- Channel is {{channel}}: for SMS keep it under 300 characters.
```

User message = structured blocks: `PROPERTY KNOWLEDGE BASE`, `LEAD`, `THREAD`, `TASK` ("Draft the next reply to this lead."). `regenerate=true` appends "Offer a different angle or phrasing than: <previous draft>".

## Behavior & guardrails

- Draft returned to client; user edits freely; **Use draft → send** goes through the normal `POST /leads/:id/messages` pipeline with `viaAi: true` → `LeadEvent(AI_REPLY_SENT)` + pauses active enrollment (human has taken over).
- If lead has no consented channel, the card still drafts (useful for copy-paste to PMS inbox) but Send is disabled with the reason.
- Timeout 8s → friendly error + retry. Cost guard: rate-limit 20 drafts/lead/day.
- Log prompt+completion ids (not bodies) for debugging; never store drafts unless sent.
- Empty knowledge base → banner on the card: "Add property FAQ to make drafts smarter" linking to the property form.

## Post-MVP hooks (design for, don't build)

Auto-suggest mode (draft attached to every inbound reply notification), inbox-wide assistant for PMS-synced conversations, per-sequence AI-personalized step bodies, and a feedback loop (thumbs on drafts → few-shot examples per org).
