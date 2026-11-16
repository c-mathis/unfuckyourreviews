# UFYT resolution delivery

New UFYT quiz/contact submissions in debt buckets above $10,000 are routed to
`lead_route = resolution` after explicit referral consent. The entire $0–$10,000
bucket, unknown amounts, and existing canonical UFYT prospects remain with UFYT.
Historical leads are not exported. Repeats do not create another delivery.

The intake INSERT stores the route, random UUID transaction ID, pending delivery
state and a timestamp two minutes in the future together. The one-minute cron
claims due leads atomically, invokes the `FIVE_STAR_DELIVERY` service binding and
stores the returned Salesforce ID. Normal delivery is approximately 2–3 minutes.
Existing follow-up, booking, Meta and Inbox tasks retain their five-minute cadence.

The binding targets the existing `trc-meta-intake` Worker. Its authenticated UFYT
relay reuses the existing Salesforce credentials and fixed `Cam - Web Forms`
source. Only name, email, phone, displayed debt band and random transaction ID
leave UFYT. URLs, campaign fields, case notes and UFYT IDs are not forwarded.

Resolution leads receive the separate on-page confirmation and Five Star's own
Salesforce-triggered welcome messages. UFYT's immediate customer confirmation,
personal email sequence and repeat booking acknowledgement are suppressed.
Internal UFYT notifications and the existing lead mirror remain active.

`UFYT_RESOLUTION_ENABLED` controls new resolution routing and processing. Setting
it false preserves queued leads and returns new intake to UFYT. The shared
`UFYT_RESOLUTION_RELAY_SECRET` lives only in the two Workers' secrets. A protected
`POST /api/ufyt/resolution/check` verifies the binding and Salesforce OAuth without
creating a Lead. Never log or include the secret in a URL.

Delivery status is separate from `resolution_sale_status` (pending/sold/paid/rejected).
Update sale status in the Resolution tab. A delivered API record is not automatically
a sale or a payment. Failed validation is terminal; ambiguous Salesforce responses
are held for review to avoid duplicate Leads. Do not reset a `needs_review` record
until its transaction ID has been checked in Salesforce.

Migration: `0009_resolution_delivery.sql`. Local validation includes SQL-backed
intake, the two-minute boundary, retries, canonical repeats, historical-prospect
protection, QA hold and email suppression. Run `npm test`.
