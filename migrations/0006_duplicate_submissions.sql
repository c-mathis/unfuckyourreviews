-- Keep one canonical UFYT lead per email while retaining every repeat submission.
ALTER TABLE leads ADD COLUMN dedupe_key TEXT;
ALTER TABLE leads ADD COLUMN duplicate_of_id INTEGER REFERENCES leads(id);

-- Link historical duplicate rows to the best canonical record. A record that
-- already booked/replied/progressed wins; otherwise the first submission wins.
UPDATE leads AS duplicate
SET duplicate_of_id = (
  SELECT canonical.id
  FROM leads AS canonical
  WHERE canonical.source = duplicate.source
    AND lower(trim(canonical.email)) = lower(trim(duplicate.email))
  ORDER BY
    CASE
      WHEN canonical.booked_at IS NOT NULL
        OR canonical.replied_at IS NOT NULL
        OR canonical.status IN ('qualified', 'proposal_sent', 'won')
      THEN 0 ELSE 1
    END,
    canonical.id
  LIMIT 1
)
WHERE duplicate.source = 'taxes'
  AND trim(COALESCE(duplicate.email, '')) <> ''
  AND duplicate.id <> (
    SELECT canonical.id
    FROM leads AS canonical
    WHERE canonical.source = duplicate.source
      AND lower(trim(canonical.email)) = lower(trim(duplicate.email))
    ORDER BY
      CASE
        WHEN canonical.booked_at IS NOT NULL
          OR canonical.replied_at IS NOT NULL
          OR canonical.status IN ('qualified', 'proposal_sent', 'won')
        THEN 0 ELSE 1
      END,
      canonical.id
    LIMIT 1
  );

-- Keep the rows for audit history, but remove them from unique-lead reporting
-- and stop any standard follow-up steps that have not gone out yet.
UPDATE leads
SET status = 'duplicate',
    next_action = 'See canonical lead #' || duplicate_of_id,
    next_action_date = NULL,
    updated_at = datetime('now')
WHERE source = 'taxes' AND duplicate_of_id IS NOT NULL;

UPDATE email_sequence
SET status = 'cancelled',
    last_error = 'Historical duplicate consolidated by migration 0006',
    updated_at = datetime('now')
WHERE lead_id IN (
  SELECT id FROM leads WHERE source = 'taxes' AND duplicate_of_id IS NOT NULL
)
  AND status IN ('pending', 'failed');

-- Canonical records get the identity key used by all future submissions.
UPDATE leads
SET dedupe_key = 'email:' || lower(trim(email))
WHERE source = 'taxes'
  AND trim(COALESCE(email, '')) <> ''
  AND duplicate_of_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_dedupe_key
  ON leads(source, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  event_id TEXT,
  submission_type TEXT NOT NULL DEFAULT 'repeat',
  surface TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  payload_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_submissions_event_id
  ON lead_submissions(event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_submissions_lead
  ON lead_submissions(lead_id, created_at DESC);

-- A repeat submit gets one acknowledgement per UTC day, even if the form is
-- sent several times or two browser requests arrive together.
CREATE TABLE IF NOT EXISTS repeat_acknowledgements (
  lead_id INTEGER NOT NULL,
  acknowledgement_day TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  email_id TEXT,
  sent_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (lead_id, acknowledgement_day),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
