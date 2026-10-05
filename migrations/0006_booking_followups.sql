-- Booking reminders, sales pings, and no-show recovery for UFYT calls.
CREATE TABLE IF NOT EXISTS lead_bookings (
  booking_id TEXT PRIMARY KEY,
  lead_id INTEGER,
  name TEXT,
  email TEXT,
  phone TEXT,
  time_zone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  booking_url TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled | superseded
  outcome TEXT,                              -- NULL | showed | no_show
  outcome_at TEXT,
  outcome_by TEXT,                           -- link | auto | lead-desk
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_bookings_lead ON lead_bookings(lead_id);

CREATE TABLE IF NOT EXISTS booking_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL,
  kind TEXT NOT NULL,                        -- lead_24h | lead_1h | sales_15m | sales_outcome | lead_no_show
  send_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | sent | skipped | cancelled | failed
  email_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (booking_id, kind),
  FOREIGN KEY (booking_id) REFERENCES lead_bookings(booking_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_messages_due ON booking_messages(status, send_at);
