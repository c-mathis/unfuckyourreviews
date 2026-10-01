import {
  buildBookingLink,
  firstNameFor,
  getUfytEmailSequenceConfig,
} from './ufyt-email-sequence.js';

const SIGNATURE = 'Trevon R\nChief Tax Unf*cker\n213-752-5732\nunfuckyourtaxes.com';

export function normalizeLeadEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeLeadPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.length === 10 ? digits : '';
}

export function buildUfytDedupeKey(data) {
  const email = normalizeLeadEmail(data?.email);
  if (email) return `email:${email}`;
  const phone = normalizeLeadPhone(data?.phone);
  return phone ? `phone:${phone}` : null;
}

export async function findExistingUfytLead(env, data) {
  const key = buildUfytDedupeKey(data);
  if (!key) return null;
  return env.DB.prepare(`
    SELECT id, name, email, phone, status, email_opt_out, booked_at, replied_at, created_at
    FROM leads
    WHERE source = 'taxes' AND dedupe_key = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).bind(key).first();
}

export async function recordUfytRepeatSubmission(env, { lead, data, clientIp, userAgent }) {
  const result = await env.DB.prepare(`
    INSERT OR IGNORE INTO lead_submissions (
      lead_id, event_id, submission_type, surface, name, email, phone,
      payload_json, ip_address, user_agent
    ) VALUES (?, ?, 'repeat', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    lead.id,
    data.event_id || null,
    data.surface || null,
    data.name || null,
    data.email || null,
    data.phone || null,
    JSON.stringify(data),
    clientIp || null,
    userAgent || null,
  ).run();

  const recorded = Number(result.meta?.changes || 0) > 0;
  if (!recorded) return { recorded: false };

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE leads
      SET updated_at = datetime('now'),
          next_action = CASE
            WHEN status IN ('new', 'contacted') THEN 'Repeat submission received — contact or confirm booking'
            ELSE next_action
          END,
          next_action_date = CASE
            WHEN status IN ('new', 'contacted') THEN datetime('now')
            ELSE next_action_date
          END
      WHERE id = ?
    `).bind(lead.id),
    env.DB.prepare(`
      INSERT INTO activity_log (lead_id, activity_type, description)
      VALUES (?, 'repeat_submission', ?)
    `).bind(
      lead.id,
      `Repeat ${data.surface || 'form'} submission received; no new lead, Meta conversion, or follow-up sequence created`,
    ),
  ]);
  return { recorded: true };
}

export async function reserveUfytRepeatAcknowledgement(env, leadId, day) {
  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO repeat_acknowledgements (lead_id, acknowledgement_day)
    VALUES (?, ?)
  `).bind(leadId, day).run();
  if (Number(inserted.meta?.changes || 0) > 0) return true;

  const retry = await env.DB.prepare(`
    UPDATE repeat_acknowledgements
    SET status = 'pending', updated_at = datetime('now')
    WHERE lead_id = ? AND acknowledgement_day = ?
      AND (
        status = 'failed'
        OR (status = 'pending' AND updated_at < datetime('now', '-5 minutes'))
      )
  `).bind(leadId, day).run();
  return Number(retry.meta?.changes || 0) > 0;
}

export function buildUfytRepeatAcknowledgement(config, lead, data = {}) {
  const first = firstNameFor(lead, data);
  const bookingUrl = buildBookingLink(config, lead, 'repeat');
  const greeting = first ? `Hey ${first},` : 'Hey,';
  const paragraphs = [
    greeting,
    `We already received your information. We're looking into it.`,
    `If you want to talk sooner, schedule a call here: ${bookingUrl}`,
    `Or call or text me at ${config.phone}.`,
    SIGNATURE,
  ];
  const text = paragraphs.join('\n\n');
  const phoneDigits = String(config.phone).replace(/\D/g, '');
  const phoneHref = phoneDigits.length === 10 ? `tel:+1${phoneDigits}` : `tel:${phoneDigits}`;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#111111;font-size:16px;line-height:1.5">
${paragraphs.map((paragraph) => {
    let escaped = escapeHtml(paragraph).replaceAll('\n', '<br>');
    escaped = escaped.replaceAll(escapeHtml(bookingUrl), `<a href="${escapeHtml(bookingUrl)}" style="color:#078bff">${escapeHtml(bookingUrl)}</a>`);
    escaped = escaped.replaceAll(escapeHtml(config.phone), `<a href="${phoneHref}" style="color:#111111">${escapeHtml(config.phone)}</a>`);
    escaped = escaped.replaceAll('unfuckyourtaxes.com', '<a href="https://unfuckyourtaxes.com" style="color:#111111">unfuckyourtaxes.com</a>');
    return `<p style="margin:0 0 16px">${escaped}</p>`;
  }).join('\n')}
</div>`;
  return {
    subject: 'We already have your information.',
    text,
    html,
    bookingUrl,
  };
}

export async function sendUfytRepeatAcknowledgement(env, { lead, data, day }) {
  const config = getUfytEmailSequenceConfig(env);
  if (!config.resendApiKey || !lead?.email) return { sent: false, reason: 'not-configured' };
  const rendered = buildUfytRepeatAcknowledgement(config, lead, data);
  const response = await fetch(`${config.resendBase}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `ufyt-repeat-${lead.id}-${day}`,
    },
    body: JSON.stringify({
      from: config.from,
      to: [lead.email],
      reply_to: config.replyTo,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) {
    const message = payload.message || `Resend ${response.status}`;
    await env.DB.prepare(`
      UPDATE repeat_acknowledgements
      SET status = 'failed', last_error = ?, updated_at = datetime('now')
      WHERE lead_id = ? AND acknowledgement_day = ?
    `).bind(String(message).slice(0, 500), lead.id, day).run();
    throw new Error(message);
  }

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE repeat_acknowledgements
      SET status = 'sent', email_id = ?, sent_at = datetime('now'), last_error = NULL, updated_at = datetime('now')
      WHERE lead_id = ? AND acknowledgement_day = ?
    `).bind(payload.id, lead.id, day),
    env.DB.prepare(`
      INSERT INTO activity_log (lead_id, activity_type, description)
      VALUES (?, 'repeat_confirmation_sent', ?)
    `).bind(lead.id, `Repeat-submission acknowledgement sent (${payload.id})`),
  ]);
  return { sent: true, id: payload.id };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
