const META_GRAPH_VERSION = 'v21.0';
const UFYT_PIXEL_ID = '1708599440630382';
const MAX_ATTEMPTS = 10;

function json(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function unixSeconds(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? Math.floor(date.getTime() / 1000) : Math.floor(Date.now() / 1000);
}

function splitName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `1${digits}` : digits;
}

async function hashSHA256(value) {
  const bytes = new TextEncoder().encode(String(value).toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function makeFbc(fbclid, eventTime) {
  return fbclid ? `fb.1.${eventTime * 1000}.${fbclid}` : undefined;
}

export function normalizePurchaseEvent(body, now = new Date()) {
  const eventId = String(body.eventId || '').trim();
  const orderId = String(body.orderId || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const amountCents = Number(body.amountCents);
  const currency = String(body.currency || 'usd').trim().toUpperCase();
  const paidAt = body.paidAt ? new Date(body.paidAt) : now;
  if (!/^[A-Za-z0-9_:-]{8,180}$/.test(eventId)) throw new Error('Invalid purchase event ID');
  if (!orderId || orderId.length > 180) throw new Error('Invalid purchase order ID');
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error('Invalid purchase email');
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > 99_999_999) throw new Error('Invalid purchase amount');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid purchase currency');
  if (!Number.isFinite(paidAt.getTime())) throw new Error('Invalid purchase timestamp');
  return { eventId, orderId, email, name, amountCents, currency, paidAt };
}

async function findLead(env, { leadId, email }) {
  if (leadId && /^\d+$/.test(String(leadId))) {
    const row = await env.DB.prepare(`SELECT * FROM leads WHERE id = ? AND source = 'taxes'`).bind(Number(leadId)).first();
    if (row) return row;
  }
  if (!email) return null;
  return env.DB.prepare(`
    SELECT * FROM leads
    WHERE source = 'taxes' AND email = ? COLLATE NOCASE AND duplicate_of_id IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).bind(email).first();
}

async function enqueue(env, event) {
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO meta_conversion_events
      (id, event_name, event_time, event_source_url, lead_id, user_data_json, custom_data_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.id,
    event.eventName,
    event.eventTime,
    event.eventSourceUrl,
    event.leadId || null,
    JSON.stringify(event.userData || {}),
    JSON.stringify(event.customData || {}),
  ).run();
  return { queued: (result.meta?.changes || 0) > 0, eventId: event.id };
}

export function scheduleMetaEvent({ bookingId, leadId, email, name, phone, eventTime = new Date() }) {
  return {
    id: `ufyt_schedule_${bookingId}`,
    eventName: 'Schedule',
    eventTime: unixSeconds(eventTime),
    eventSourceUrl: 'https://book.ufyt.dev/',
    leadId: leadId || null,
    userData: { email, name, phone },
    customData: {
      content_name: 'Tax Consultation',
      content_category: 'Lead Generation',
      value: 0,
      currency: 'USD',
    },
  };
}

export function attendedMetaEvent({ bookingId, leadId, email, name, phone, eventTime = new Date() }) {
  return {
    id: `ufyt_attended_${bookingId}`,
    eventName: 'ConsultationAttended',
    eventTime: unixSeconds(eventTime),
    eventSourceUrl: 'https://book.ufyt.dev/',
    leadId: leadId || null,
    userData: { email, name, phone },
    customData: {
      content_name: 'Tax Consultation Attended',
      content_category: 'Lead Generation',
      value: 0,
      currency: 'USD',
    },
  };
}

export async function enqueueUfytSchedule(env, details) {
  return enqueue(env, scheduleMetaEvent(details));
}

export async function enqueueUfytAttended(env, details) {
  return enqueue(env, attendedMetaEvent(details));
}

export async function enqueueUfytPurchase(env, body) {
  const purchase = normalizePurchaseEvent(body);
  const lead = await findLead(env, { leadId: body.leadId, email: purchase.email });
  return enqueue(env, {
    id: purchase.eventId,
    eventName: 'Purchase',
    eventTime: unixSeconds(purchase.paidAt),
    eventSourceUrl: 'https://payments.ufyt.dev/',
    leadId: lead?.id || null,
    userData: { email: purchase.email, name: purchase.name },
    customData: {
      content_name: 'UFYT Deposit',
      content_category: 'Professional Services',
      value: purchase.amountCents / 100,
      currency: purchase.currency,
      order_id: purchase.orderId,
    },
  });
}

async function loadUserData(env, row) {
  const fallback = json(row.user_data_json);
  const lead = row.lead_id
    ? await env.DB.prepare(`SELECT id, name, email, phone, ip_address, user_agent, fbclid, payload_json, created_at FROM leads WHERE id = ?`).bind(row.lead_id).first()
    : null;
  const payload = json(lead?.payload_json);
  const fallbackName = splitName(fallback.name);
  const leadName = splitName(lead?.name);
  const email = lead?.email || fallback.email;
  const phone = lead?.phone || fallback.phone;
  const firstName = payload.first_name || leadName.firstName || fallbackName.firstName;
  const lastName = payload.last_name || leadName.lastName || fallbackName.lastName;
  const hashed = {
    em: email ? [await hashSHA256(email)] : undefined,
    ph: phone ? [await hashSHA256(normalizePhone(phone))] : undefined,
    fn: firstName ? [await hashSHA256(firstName)] : undefined,
    ln: lastName ? [await hashSHA256(lastName)] : undefined,
    external_id: lead?.id ? [await hashSHA256(`ufyt:${lead.id}`)] : undefined,
    client_ip_address: lead?.ip_address || undefined,
    client_user_agent: lead?.user_agent || undefined,
    fbp: payload.fbp || undefined,
    fbc: payload.fbc || makeFbc(payload.fbclid || lead?.fbclid, unixSeconds(lead?.created_at || row.event_time * 1000)),
  };
  return Object.fromEntries(Object.entries(hashed).filter(([, value]) => value !== undefined && value !== ''));
}

export async function buildMetaEventPayload(env, row) {
  return {
    event_name: row.event_name,
    event_time: row.event_time,
    event_id: row.id,
    event_source_url: row.event_source_url,
    action_source: 'website',
    user_data: await loadUserData(env, row),
    custom_data: json(row.custom_data_json),
  };
}

async function send(env, row) {
  if (!env.UFYT_META_ACCESS_TOKEN) throw new Error('UFYT Meta access token is not configured');
  const event = await buildMetaEventPayload(env, row);
  const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${UFYT_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event], access_token: env.UFYT_META_ACCESS_TOKEN }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(`Meta CAPI ${response.status}: ${JSON.stringify(result.error || result).slice(0, 500)}`);
  return result;
}

export async function processUfytMetaEvents(env, { limit = 25 } = {}) {
  if (!env.UFYT_META_ACCESS_TOKEN) return { processed: 0, sent: 0, failed: 0, skipped: 'no-meta-token' };
  const due = await env.DB.prepare(`
    SELECT * FROM meta_conversion_events
    WHERE status IN ('pending', 'failed') AND attempts < ? AND next_attempt_at <= datetime('now')
    ORDER BY event_time ASC LIMIT ?
  `).bind(MAX_ATTEMPTS, Math.min(Math.max(Number(limit) || 25, 1), 100)).all();
  const outcome = { processed: due.results.length, sent: 0, failed: 0 };
  for (const row of due.results) {
    try {
      const response = await send(env, row);
      await env.DB.prepare(`
        UPDATE meta_conversion_events
        SET status = 'sent', attempts = attempts + 1, sent_at = datetime('now'),
            last_error = NULL, meta_response_json = ?, updated_at = datetime('now')
        WHERE id = ? AND status != 'sent'
      `).bind(JSON.stringify(response).slice(0, 2000), row.id).run();
      outcome.sent += 1;
    } catch (error) {
      const delayMinutes = Math.min(360, 2 ** Math.min(Number(row.attempts) || 0, 8));
      await env.DB.prepare(`
        UPDATE meta_conversion_events
        SET status = 'failed', attempts = attempts + 1, last_error = ?,
            next_attempt_at = datetime('now', ?), updated_at = datetime('now')
        WHERE id = ?
      `).bind(String(error?.message || error).slice(0, 1000), `+${delayMinutes} minutes`, row.id).run();
      console.error('UFYT Meta event failed:', row.id, error?.message || error);
      outcome.failed += 1;
    }
  }
  return outcome;
}
