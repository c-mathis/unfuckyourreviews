-- Existing leads remain UFYT. Only newly submitted, consented leads are queued.
ALTER TABLE leads ADD COLUMN lead_route TEXT NOT NULL DEFAULT 'ufyt';
ALTER TABLE leads ADD COLUMN partner_transaction_id TEXT;
ALTER TABLE leads ADD COLUMN resolution_status TEXT;
ALTER TABLE leads ADD COLUMN resolution_send_after TEXT;
ALTER TABLE leads ADD COLUMN resolution_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN resolution_locked_at TEXT;
ALTER TABLE leads ADD COLUMN resolution_delivered_at TEXT;
ALTER TABLE leads ADD COLUMN resolution_partner_id TEXT;
ALTER TABLE leads ADD COLUMN resolution_last_error TEXT;
ALTER TABLE leads ADD COLUMN resolution_sale_status TEXT NOT NULL DEFAULT 'pending';
CREATE UNIQUE INDEX idx_resolution_transaction ON leads(partner_transaction_id)
  WHERE partner_transaction_id IS NOT NULL;
CREATE INDEX idx_resolution_due ON leads(lead_route, resolution_status, resolution_send_after);
CREATE TABLE resolution_delivery_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  attempt INTEGER NOT NULL,
  outcome TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
