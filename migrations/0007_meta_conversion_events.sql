CREATE TABLE IF NOT EXISTS meta_conversion_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_time INTEGER NOT NULL,
  event_source_url TEXT NOT NULL,
  lead_id INTEGER,
  user_data_json TEXT NOT NULL DEFAULT '{}',
  custom_data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  meta_response_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_meta_conversion_events_due
  ON meta_conversion_events(status, next_attempt_at);
