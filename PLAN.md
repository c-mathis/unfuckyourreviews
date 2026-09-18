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
- [x] Add /api/integrations/calls to Communications OS that appends a call record to the lead's conversation, creating the contact and conversation for unknown callers, with vitest coverage
- [x] Mirror each completed call from the Worker to Communications OS after the D1 write
- [x] Show calls (source, caller, duration, status, recording link) in the UFYT Lead Desk

### Phase 2b: Inbound SMS on the tracking numbers
- [x] Add migration 0004_sms.sql and the /api/sms/inbound webhook that verifies the Twilio signature, stores texts sent to the tracking numbers, links the sender to a lead, and alerts sales
- [x] Add /api/integrations/sms to Communications OS that appends inbound texts to the lead's conversation, with vitest coverage, and mirror each stored text from the Worker
- [x] Add scripts/provision-twilio.mjs that buys the two local numbers, sets their voice, status, and SMS webhooks, creates the UFYT Messaging Service, and prints the Worker secret values
- [x] Add SMS consent capture to the UFYT quiz (unchecked checkbox with TCPA disclosure) and store consent text version, timestamp, and page on the lead
- [x] Add the automated SMS follow-up sequence (immediate, 24h, 72h) driven by a Worker cron trigger and a queue table, sent only to consented, non-opted-out leads, with delivery status callbacks
- [x] Handle STOP/UNSUBSCRIBE replies by marking the lead opted out and cancelling pending sequence steps
- [x] Draft the 10DLC marketing campaign registration content (use case, opt-in description, sample messages, consent language) in the vault for Cameron to submit

### Phase 3: Provisioning and go-live
- [ ] Cameron confirms the Forti.fi/UFYT Twilio subaccount and buys two local numbers, one for email follow-up and one for Meta ads
- [ ] Run the provisioning script against the Forti.fi/UFYT subaccount and store the auth token, forward-to number, tracking-number map, API key, and Messaging Service SID as Worker secrets
- [ ] Register the Forti.fi A2P 10DLC Brand and low-volume mixed Campaign and attach the Messaging Service so outbound SMS (alerts, auto-replies, follow-ups) is deliverable
- [ ] Deploy the Worker and apply the calls migration to the production D1 database
- [ ] Place a live test call on each number and verify forward, whisper, recording, Lead Desk row, inbox entry, and missed-call alert
- [ ] Put the numbers into the follow-up email template and Meta ad copy and record the outcome in the vault

## Change Log
<!-- One line per scope change, BEFORE touching the checklist. For "changed", quote both old and new text. -->
<!-- - YYYY-MM-DD | added|removed|changed | "exact step text" | reason | approved: who -->
- 2026-09-18 | added | "Add migration 0004_sms.sql and the /api/sms/inbound webhook that verifies the Twilio signature, stores texts sent to the tracking numbers, links the sender to a lead, and alerts sales" | Cameron: "we're going to need SMS" | approved: Cameron
- 2026-09-18 | added | "Add /api/integrations/sms to Communications OS that appends inbound texts to the lead's conversation, with vitest coverage, and mirror each stored text from the Worker" | Cameron: "we're going to need SMS" | approved: Cameron
- 2026-09-18 | added | "Add scripts/provision-twilio.mjs that buys the two local numbers, sets their voice, status, and SMS webhooks, creates the UFYT Messaging Service, and prints the Worker secret values" | Cameron is in Twilio and asked to begin provisioning; the API path avoids manual console work | approved: Cameron
- 2026-09-18 | added | "Register the Forti.fi A2P 10DLC Brand and low-volume mixed Campaign and attach the Messaging Service so outbound SMS (alerts, auto-replies, follow-ups) is deliverable" | Outbound US SMS is blocked without registration | approved: Cameron
- 2026-09-18 | added | "Add SMS consent capture to the UFYT quiz (unchecked checkbox with TCPA disclosure) and store consent text version, timestamp, and page on the lead" | Cameron: "The SMS is for sms marketing. Sending texts automated to leads that submit" | approved: Cameron
- 2026-09-18 | added | "Add the automated SMS follow-up sequence (immediate, 24h, 72h) driven by a Worker cron trigger and a queue table, sent only to consented, non-opted-out leads, with delivery status callbacks" | Cameron: "The SMS is for sms marketing" | approved: Cameron
- 2026-09-18 | added | "Handle STOP/UNSUBSCRIBE replies by marking the lead opted out and cancelling pending sequence steps" | required for marketing SMS compliance | approved: Cameron
- 2026-09-18 | added | "Draft the 10DLC marketing campaign registration content (use case, opt-in description, sample messages, consent language) in the vault for Cameron to submit" | required before outbound marketing SMS can deliver | approved: Cameron
- 2026-09-18 | changed | "Cameron adds the Twilio auth token, forward-to number, and tracking-number map as Worker secrets and points each number's voice webhook and status callback at the Worker" | now "Run the provisioning script against the Forti.fi/UFYT subaccount and store the auth token, forward-to number, tracking-number map, API key, and Messaging Service SID as Worker secrets" because provisioning is scripted | approved: Cameron

## Decisions
- 2026-09-18 — Build call tracking on the Forti.fi/UFYT Twilio subaccount instead of CallRail — two static numbers need no dynamic number insertion, and calls belong beside quiz leads in the existing Lead Desk and Communications OS.
- 2026-09-18 — Voice-only numbers first — A2P 10DLC registration only gates SMS, so the open Forti.fi EIN item does not block calls.
- 2026-09-18 — Play a recording disclosure before forwarding — California is a two-party consent state.
- 2026-09-18 — Tracking-number to source map and forward-to number live in Worker secrets, never in the repo or vault.

- 2026-09-18 — Lead Desk changes live on branch `ufyt-leaddesk-calls` in c-mathis/unfuckyourtaxes (lead-dashboard/src/index.js); Communications OS changes on branch `ufyt-call-events` in c-mathis/communications-os — the plan tracks all three repos from this one file.
- 2026-09-18 — Whisper is announce-only (no press-1 screening) — keeps pickup friction at zero; the trade-off is that a carrier voicemail can count as answered. Revisit if missed-call alerts look wrong in the first week.
- 2026-09-18 — Unknown callers become a lead with a synthetic `phone-<digits>@calls.unfuckyourtaxes.com` email — the leads table and the inbox contact model both key on email; the address is never mailed.

- 2026-09-18 — Twilio blocks number purchase until Trust Hub KYC is approved (error 20003, "Primary compliance profile is not approved"). Parent account has no Primary Customer Profile and no numbers; subaccount `Forti.fi / UFYT` was created but cannot buy numbers yet. Cameron completes the Primary Business Profile (Mathis LLC) and a Secondary Customer Profile (Forti.fi LLC) assigned to the subaccount; then rerun `scripts/provision-twilio.mjs --apply-secrets`.

## Definition of Done
- [ ] A call to either tracking number rings the sales phone with a whisper naming the source and is recorded after the disclosure
- [ ] Every call appears in the calls table, the Lead Desk, and the lead's Communications OS conversation
- [ ] Missed calls trigger an internal alert within a minute
- [ ] Twilio webhooks reject requests with an invalid signature
