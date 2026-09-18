-- Call tracking: one row per Twilio call to a UFYT tracking number.
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_sid TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL DEFAULT 'ufyt',
  tracking_number TEXT NOT NULL,       -- E.164 Twilio number that was dialed
  source TEXT NOT NULL,                -- label from the tracking-number map, e.g. 'email-followup', 'meta-ads'
  caller TEXT,                         -- E.164 caller ID when available
  caller_name TEXT,                    -- CNAM lookup result when Twilio supplies it
  caller_city TEXT,
  caller_state TEXT,
  forwarded_to TEXT,                   -- E.164 sales phone the call was bridged to
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, ringing, in-progress, completed, busy, no-answer, failed, canceled
  dial_status TEXT,                    -- outcome of the forwarded leg: completed, busy, no-answer, failed, canceled
  answered INTEGER NOT NULL DEFAULT 0, -- 1 when the sales phone picked up
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  recording_sid TEXT,
  recording_url TEXT,
  recording_duration_seconds INTEGER,
  lead_id INTEGER,                     -- matched or created lead
  lead_created INTEGER NOT NULL DEFAULT 0, -- 1 when this call created the lead row
  alerted_at TEXT,                     -- when the missed-call alert went out
  mirrored_at TEXT,                    -- when the call was mirrored into Communications OS
  payload_json TEXT,                   -- last raw Twilio callback payload
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
