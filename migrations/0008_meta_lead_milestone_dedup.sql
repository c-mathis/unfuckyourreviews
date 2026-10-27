-- A repeat or follow-up booking is still the same funnel milestone. This also
-- protects leads created under the original booking-based event ID scheme.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_conversion_events_lead_milestone
  ON meta_conversion_events(event_name, lead_id)
  WHERE lead_id IS NOT NULL
    AND event_name IN ('Schedule', 'ConsultationAttended');
