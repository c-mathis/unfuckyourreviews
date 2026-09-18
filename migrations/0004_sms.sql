-- SMS marketing: consent on the lead, a message log, and the follow-up queue.
ALTER TABLE leads ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN sms_consent_text TEXT;
ALTER TABLE leads ADD COLUMN sms_consent_at TEXT;
ALTER TABLE leads ADD COLUMN sms_consent_page TEXT;
ALTER TABLE leads ADD COLUMN sms_opt_out INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN sms_opt_out_at TEXT;

CREATE TABLE IF NOT EXISTS sms_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_sid TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL DEFAULT 'ufyt',
  direction TEXT NOT NULL,             -- inbound | outbound
  tracking_number TEXT,                -- our number on the message
  source TEXT,                         -- tracking-number label for inbound; 'sequence' or 'alert' for outbound
  counterpart TEXT NOT NULL,           -- E.164 of the lead / sender
  body TEXT NOT NULL DEFAULT '',
  num_media INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received', -- received | queued | sent | delivered | undelivered | failed
  error_code TEXT,
  lead_id INTEGER,
  sequence_step INTEGER,
  opt_out INTEGER NOT NULL DEFAULT 0,  -- 1 when this inbound message was a STOP keyword
  alerted_at TEXT,
  mirrored_at TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS sms_sequence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  step INTEGER NOT NULL,
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | skipped | cancelled | failed
  message_sid TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lead_id, step),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_lead_id ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_counterpart ON sms_messages(counterpart);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_sequence_due ON sms_sequence(status, send_at);
