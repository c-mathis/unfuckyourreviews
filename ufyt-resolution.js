export const RESOLUTION_CONSENT_VERSION = 'ufyt-resolution-2026-11-16';
export const RESOLUTION_CONSENT_TEXT = 'I agree to have my contact details and tax debt amount shared with an independent tax resolution firm, which may call, text, or email me about my request. UFYT may receive compensation for this referral. Consent is not a condition of purchase.';
export const RESOLUTION_SUBMIT_CONSENT_VERSION = 'ufyt-resolution-submit-2026-11-16';
export const RESOLUTION_SUBMIT_CONSENT_TEXT = 'By sending, you agree we may share your contact details and tax debt amount with an independent tax resolution firm that may call, text or email you about your enquiry. UFYT may receive a referral fee. Consent is not required to purchase.';
export const RESOLUTION_PATH = '/resolution-thank-you';

export async function checkResolutionConnection(request, env) {
  if (!env.UFYT_RESOLUTION_RELAY_SECRET) return Response.json({ error: 'disabled' }, { status: 503 });
  const encoder = new TextEncoder();
  const digests = await Promise.all([request.headers.get('Authorization') || '', `Bearer ${env.UFYT_RESOLUTION_RELAY_SECRET}`]
    .map(v => crypto.subtle.digest('SHA-256', encoder.encode(v))));
  const a = new Uint8Array(digests[0]), b = new Uint8Array(digests[1]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.FIVE_STAR_DELIVERY) return Response.json({ error: 'relay-not-configured' }, { status: 503 });
  return env.FIVE_STAR_DELIVERY.fetch('https://five-star-internal/api/partner/ufyt?verify=1', {
    method: 'POST', headers: { Authorization: `Bearer ${env.UFYT_RESOLUTION_RELAY_SECRET}` },
  });
}

// Match displayed choices, never free-text case notes or a client-supplied route.
export function resolutionDebt(data = {}) {
  const value = String(data.debt_amount || data.amount_owed || '').trim();
  if (/^\$[\d,]+\s*[-–]\s*\$[\d,]+$/.test(value)) {
    const [low, high] = value.split(/[-–]/).map(s => Number(s.replace(/[^\d]/g, '')));
    if (low >= 10000 && high > 10000 && high >= low) return value;
  }
  if (/^Over \$100k$/i.test(value)) return value;
  return null;
}

export function hasResolutionConsent(data) {
  const consent = data.resolution_consent;
  if (consent?.accepted !== true) return false;
  // Keep existing records and already-open checkbox forms valid.
  if (consent.version === RESOLUTION_CONSENT_VERSION) {
    return consent.text === RESOLUTION_CONSENT_TEXT;
  }
  return consent.version === RESOLUTION_SUBMIT_CONSENT_VERSION
    && consent.text === RESOLUTION_SUBMIT_CONSENT_TEXT
    && consent.acceptance_method === 'form_submit'
    && typeof consent.captured_at === 'string'
    && Number.isFinite(Date.parse(consent.captured_at));
}

export function resolutionPayload(lead) {
  let data;
  try { data = JSON.parse(lead.payload_json); } catch { throw new Error('invalid-payload'); }
  const parts = String(lead.name || '').trim().split(/\s+/);
  const firstName = String(data.first_name || parts.shift() || '').trim();
  const lastName = String(data.last_name || parts.join(' ') || firstName).trim();
  const debt = resolutionDebt(data);
  if (!debt || !hasResolutionConsent(data)) throw new Error('missing-resolution-consent');
  return {
    transaction_id: lead.partner_transaction_id,
    first_name: firstName,
    last_name: lastName,
    email: lead.email,
    phone: String(lead.phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''),
    debt_amount: debt,
  };
}

export async function processResolutionDeliveries(env, { now = new Date(), limit = 20 } = {}) {
  if (env.UFYT_RESOLUTION_ENABLED !== 'true') return { skipped: 'disabled' };
  if (!env.FIVE_STAR_DELIVERY || !env.UFYT_RESOLUTION_RELAY_SECRET) throw new Error('resolution-relay-not-configured');
  const at = now.toISOString();
  // A stale request is replayed with the SAME transaction ID; the relay ledger
  // returns an existing receipt or holds an ambiguous Salesforce send for review.
  await env.DB.prepare(`UPDATE leads SET resolution_status = 'pending'
    WHERE lead_route = 'resolution' AND resolution_status = 'sending'
    AND resolution_locked_at < ?`).bind(new Date(now.getTime() - 300000).toISOString()).run();
  const due = await env.DB.prepare(`SELECT id FROM leads WHERE lead_route = 'resolution'
    AND resolution_status = 'pending' AND resolution_send_after <= ?
    AND duplicate_of_id IS NULL ORDER BY resolution_send_after LIMIT ?`).bind(at, limit).all();
  const result = { processed: 0, delivered: 0, failed: 0 };
  for (const { id } of due.results) {
    const lead = await env.DB.prepare(`UPDATE leads SET resolution_status = 'sending',
      resolution_attempts = resolution_attempts + 1, resolution_locked_at = ?
      WHERE id = ? AND resolution_status = 'pending' AND resolution_send_after <= ?
      RETURNING *`).bind(at, id, at).first();
    if (!lead) continue;
    result.processed++;
    let status = 'pending', partnerId = null, error = null;
    try {
      const response = await env.FIVE_STAR_DELIVERY.fetch('https://five-star-internal/api/partner/ufyt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.UFYT_RESOLUTION_RELAY_SECRET}` },
        body: JSON.stringify(resolutionPayload(lead)),
        signal: AbortSignal.timeout(30000),
      });
      const receipt = await response.json();
      if (response.ok && /^00Q[0-9A-Za-z]{12}(?:[0-9A-Za-z]{3})?$/.test(receipt.partner_record_id || '')) {
        status = 'delivered'; partnerId = receipt.partner_record_id; result.delivered++;
      } else {
        error = String(receipt.error || `relay-http-${response.status}`).slice(0, 200);
        if (receipt.review_required) status = 'needs_review';
        else if (response.status >= 400 && response.status < 500 && ![409, 429].includes(response.status)) status = 'failed';
      }
    } catch (e) { error = String(e.message).slice(0, 200); }
    if (status === 'pending' && lead.resolution_attempts >= 6) status = 'needs_review';
    const retryMinutes = [1, 5, 15, 30, 60][Math.min(lead.resolution_attempts - 1, 4)];
    const retryAt = new Date(now.getTime() + retryMinutes * 60000).toISOString();
    await env.DB.batch([
      env.DB.prepare(`UPDATE leads SET resolution_status = ?, resolution_partner_id = COALESCE(?, resolution_partner_id),
        resolution_delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE resolution_delivered_at END,
        resolution_last_error = ?, resolution_send_after = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(status, partnerId, status, at, error, retryAt, id),
      env.DB.prepare(`INSERT INTO resolution_delivery_attempts (lead_id, attempt, outcome) VALUES (?, ?, ?)`)
        .bind(id, lead.resolution_attempts, status + (error ? ': ' + error : '')),
      env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'resolution_delivery', ?)`)
        .bind(id, `Five Star delivery: ${status}${partnerId ? ' (' + partnerId + ')' : ''}`),
    ]);
    if (status !== 'delivered') result.failed++;
  }
  return result;
}
