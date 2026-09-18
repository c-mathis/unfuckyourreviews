---
project: UFYT Call Tracking Numbers
repo: c-mathis/unfuckyourreviews
branch: ufyt-call-tracking
status: active
owner: Cameron
created: 2026-09-18
updated: 2026-09-18
original_sha256: 8d3465939bcfb1f86b882dab35d31896ba88d34a40ee620f68c27433e09e5071
---

## Goal
Two Twilio tracking numbers (scheduling follow-up emails, Meta ads) forward to the UFYT sales phone, and every call is logged against a lead in the Lead Desk and shared inbox with a missed-call alert.

## Original Plan
<!-- FROZEN at approval. Never edit anything in this section. Hash-verified. -->
### Phase 1: Call logging in the lead Worker
- Add migration 0003_calls.sql creating a calls table keyed by Twilio call SID with tracking number, source label, caller, forwarded-to number, status, duration, recording URL, and linked lead ID
- Add the /api/calls/voice webhook returning TwiML that plays the recording disclosure, whispers the call source to the agent, and forwards to the sales phone with recording enabled
- Add the /api/calls/status callback that validates the Twilio request signature, upserts the call row, and links the caller to an existing lead by phone or creates a new phone lead
- Add a bearer-protected /api/calls list endpoint and include call counts in /api/stats
- Add mocked tests for TwiML output, signature validation, and status upsert, and pass a Wrangler deploy dry run

### Phase 2: Alerts, inbox mirror, and Lead Desk
- Send the internal UFYT email alert (and SMS alert when Twilio SMS is active) for missed or unanswered calls with a Lead Desk link
- Add /api/integrations/calls to Communications OS that appends a call record to the lead's conversation, creating the contact and conversation for unknown callers, with vitest coverage
- Mirror each completed call from the Worker to Communications OS after the D1 write
- Show calls (source, caller, duration, status, recording link) in the UFYT Lead Desk

### Phase 3: Provisioning and go-live
- Cameron confirms the Forti.fi/UFYT Twilio subaccount and buys two local numbers, one for email follow-up and one for Meta ads
- Cameron adds the Twilio auth token, forward-to number, and tracking-number map as Worker secrets and points each number's voice webhook and status callback at the Worker
- Deploy the Worker and apply the calls migration to the production D1 database
- Place a live test call on each number and verify forward, whisper, recording, Lead Desk row, inbox entry, and missed-call alert
- Put the numbers into the follow-up email template and Meta ad copy and record the outcome in the vault

## Current Plan
### Phase 1: Call logging in the lead Worker
- [x] Add migration 0003_calls.sql creating a calls table keyed by Twilio call SID with tracking number, source label, caller, forwarded-to number, status, duration, recording URL, and linked lead ID
- [x] Add the /api/calls/voice webhook returning TwiML that plays the recording disclosure, whispers the call source to the agent, and forwards to the sales phone with recording enabled
- [x] Add the /api/calls/status callback that validates the Twilio request signature, upserts the call row, and links the caller to an existing lead by phone or creates a new phone lead
- [x] Add a bearer-protected /api/calls list endpoint and include call counts in /api/stats
- [x] Add mocked tests for TwiML output, signature validation, and status upsert, and pass a Wrangler deploy dry run

### Phase 2: Alerts, inbox mirror, and Lead Desk
- [x] Send the internal UFYT email alert (and SMS alert when Twilio SMS is active) for missed or unanswered calls with a Lead Desk link
- [ ] Add /api/integrations/calls to Communications OS that appends a call record to the lead's conversation, creating the contact and conversation for unknown callers, with vitest coverage
- [ ] Mirror each completed call from the Worker to Communications OS after the D1 write
- [ ] Show calls (source, caller, duration, status, recording link) in the UFYT Lead Desk

### Phase 3: Provisioning and go-live
- [ ] Cameron confirms the Forti.fi/UFYT Twilio subaccount and buys two local numbers, one for email follow-up and one for Meta ads
- [ ] Cameron adds the Twilio auth token, forward-to number, and tracking-number map as Worker secrets and points each number's voice webhook and status callback at the Worker
- [ ] Deploy the Worker and apply the calls migration to the production D1 database
- [ ] Place a live test call on each number and verify forward, whisper, recording, Lead Desk row, inbox entry, and missed-call alert
- [ ] Put the numbers into the follow-up email template and Meta ad copy and record the outcome in the vault

## Change Log
<!-- One line per scope change, BEFORE touching the checklist. For "changed", quote both old and new text. -->
<!-- - YYYY-MM-DD | added|removed|changed | "exact step text" | reason | approved: who -->

## Decisions
- 2026-09-18 — Build call tracking on the Forti.fi/UFYT Twilio subaccount instead of CallRail — two static numbers need no dynamic number insertion, and calls belong beside quiz leads in the existing Lead Desk and Communications OS.
- 2026-09-18 — Voice-only numbers first — A2P 10DLC registration only gates SMS, so the open Forti.fi EIN item does not block calls.
- 2026-09-18 — Play a recording disclosure before forwarding — California is a two-party consent state.
- 2026-09-18 — Tracking-number to source map and forward-to number live in Worker secrets, never in the repo or vault.

## Definition of Done
- [ ] A call to either tracking number rings the sales phone with a whisper naming the source and is recorded after the disclosure
- [ ] Every call appears in the calls table, the Lead Desk, and the lead's Communications OS conversation
- [ ] Missed calls trigger an internal alert within a minute
- [ ] Twilio webhooks reject requests with an invalid signature
