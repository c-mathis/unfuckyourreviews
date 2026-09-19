-- UFYT email follow-up sequence: opt-out and stop signals on the lead, plus a queue.
ALTER TABLE leads ADD COLUMN email_opt_out INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN email_opt_out_at TEXT;
ALTER TABLE leads ADD COLUMN booked_at TEXT;
ALTER TABLE leads ADD COLUMN booking_url TEXT;
ALTER TABLE leads ADD COLUMN replied_at TEXT;

CREATE TABLE IF NOT EXISTS email_sequence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | skipped | cancelled | failed
  email_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lead_id, step),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_email_sequence_due ON email_sequence(status, send_at);
CREATE INDEX IF NOT EXISTS idx_email_sequence_lead ON email_sequence(lead_id);
