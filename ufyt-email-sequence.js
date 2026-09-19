// ============================================
// UFYT EMAIL FOLLOW-UP SEQUENCE
// ============================================
// Tax leads get a short follow-up sequence after the confirmation email,
// each step pointing at the booking page and the call-or-text number. Steps
// stop when the lead books, replies, opts out, or sales moves the lead past
// "new". Sending happens from a cron; enqueueing happens at submission.

const BRAND = 'Unf*ck Your Taxes';
const SEND_WINDOW = { timeZone: 'America/Los_Angeles', startHour: 8, endHour: 18 };

// Which of the quiz's "What's going on" answers this lead picked.
const PROBLEM_KEYS = [
  [/owe money/i, 'owe'],
  [/unfiled/i, 'unfiled'],
  [/notice|audit/i, 'notice'],
  [/filing or organizing|need help filing/i, 'filing'],
];

export const UFYT_EMAIL_SEQUENCE = [
  {
    step: 1,
    offsetHours: 2,
    subject: () => 'Want to skip the wait?',
    body: ({ first, bookingUrl, phone }) => [
      greet(first),
      `You’ll hear from one of us within a business day. If you’d rather not wait, grab a time and we’ll call you then:`,
      bookingUrl,
      `Or call or text ${phone}.`,
      `Have the notice or letter handy if you got one. That’s the only prep.`,
      sign(),
    ],
  },
  {
    step: 2,
    offsetHours: 26,
    subject: ({ problem }) => ({
      owe: 'About that IRS balance',
      unfiled: 'About those unfiled returns',
      notice: 'About that IRS notice',
      filing: 'About getting your taxes straightened out',
    })[problem] || 'About your tax situation',
    body: ({ first, problem, bookingUrl }) => [
      `${first ? `${first}, quick` : 'Quick'} one.`,
      {
        owe: `You told us you owe the IRS or the state. First thing we do on the call is figure out what you actually owe and what they’re likely to do next. You won’t get a number out of thin air.`,
        unfiled: `You told us you’ve got unfiled returns. Those don’t clear themselves. The IRS can file a return for you, and their version doesn’t include your deductions.`,
        notice: `You told us you got a notice or you’re being audited. Notices have deadlines, and missing one usually makes it more expensive, not less. Bring the letter to the call and we’ll tell you what it means in plain English.`,
        filing: `You told us you need help filing or getting organized. On the call we’ll tell you what it takes to get you current and what it costs. Nothing billable until you say so.`,
      }[problem] || `You told us you’re not sure what you’re dealing with. That’s fine. Most people aren’t until someone looks at the actual record. That’s what the call is for.`,
      `Still want it looked at? Pick a time and we’ll call you:`,
      bookingUrl,
      `Or just reply to this email with what’s going on.`,
      sign(),
    ],
  },
  {
    step: 3,
    offsetHours: 72,
    subject: () => 'What happens if this sits',
    body: ({ first, problem, bookingUrl }) => [
      greet(first),
      `Straight answer on what happens if this sits:`,
      ...({
        owe: [
          `- Penalties and interest keep stacking every month. The IRS doesn’t pause them while you think it over.`,
          `- Collections escalate on their schedule, not yours: letters, then liens, then levies.`,
        ],
        unfiled: [
          `- If you owe for an unfiled year, the failure-to-file penalty keeps growing until the return is in.`,
          `- If you were due a refund, you have three years to claim it. After that it’s gone.`,
          `- The IRS can file a substitute return for you, and it won’t include your deductions.`,
        ],
        notice: [
          `- The deadline on the notice is real. After it passes, your options narrow and the balance usually grows.`,
          `- Audit and CP2000 responses go better before the IRS finalizes its numbers.`,
        ],
      }[problem] || [
        `- Whatever it turns out to be, it’s cheaper to deal with early. Penalties and interest only run one direction.`,
        `- Unfiled years and unanswered notices don’t expire. They wait.`,
      ]),
      `None of that has to happen. Pick a time and let’s look at it:`,
      bookingUrl,
      sign(),
    ],
  },
  {
    step: 4,
    offsetHours: 168,
    subject: () => 'We’ll leave it here',
    body: ({ first, bookingUrl, phone }) => [
      greet(first),
      `Last one from us. If the timing’s wrong, no problem.`,
      `If you still want this sorted, pick a time or reply and we’ll call you:`,
      bookingUrl,
      `Call or text: ${phone}`,
      sign(),
    ],
  },
];

function greet(first) {
  return first ? `Hey ${first},` : 'Hey,';
}

function sign() {
  return `— ${BRAND}`;
}

export function getUfytEmailSequenceConfig(env) {
  return {
    enabled: String(env.UFYT_EMAIL_SEQUENCE_ENABLED || '').toLowerCase() === 'true',
    resendApiKey: env.UFYT_RESEND_API_KEY || null,
    resendBase: (env.UFYT_RESEND_API_BASE || 'https://api.resend.com').replace(/\/+$/, ''),
    from: env.UFYT_EMAIL_FROM || 'Unfuck Your Taxes <hello@unfuckyourtaxes.com>',
    replyTo: env.UFYT_EMAIL_REPLY_TO || 'hello@unfuckyourtaxes.com',
    bookingUrl: (env.UFYT_BOOKING_URL || 'https://book.ufyt.dev').replace(/\/+$/, ''),
    unsubscribeUrl: (env.UFYT_UNSUBSCRIBE_URL || 'https://book.ufyt.dev/email/stop').replace(/\/+$/, ''),
    phone: env.UFYT_PHONE || '213-752-5732',
    secret: env.UFYT_INTEGRATION_SECRET || null,
  };
}

// ---------- Personalization ----------

export function problemKeyFor(payload) {
  const answer = String(payload?.tax_problem || payload?.problem || payload?.situation || '');
  for (const [pattern, key] of PROBLEM_KEYS) if (pattern.test(answer)) return key;
  return 'unsure';
}

export function firstNameFor(lead, payload) {
  const explicit = String(payload?.first_name || '').trim();
  if (explicit) return explicit;
  return String(lead?.name || '').trim().split(/\s+/)[0] || '';
}

export function buildBookingLink(config, lead, step) {
  const params = new URLSearchParams();
  if (lead.id) params.set('lead', String(lead.id));
  if (lead.name) params.set('name', lead.name);
  if (lead.email) params.set('email', lead.email);
  if (lead.phone) params.set('phone', lead.phone);
  params.set('source', `email-${step}`);
  return `${config.bookingUrl}?${params.toString()}`;
}

// ---------- Rendering ----------

export function renderUfytEmailStep(config, template, lead, payload) {
  const vars = {
    first: firstNameFor(lead, payload),
    problem: problemKeyFor(payload),
    bookingUrl: buildBookingLink(config, lead, template.step),
    phone: config.phone,
  };
  const subject = template.subject(vars);
  const paragraphs = template.body(vars);
  const unsubscribe = lead.unsubscribeUrl || null;

  const text = paragraphs.join('\n\n') + (unsubscribe ? `\n\nDon’t want these? ${unsubscribe}` : '');
  const html = renderHtml(paragraphs, vars.bookingUrl, unsubscribe);
  return { subject, text, html, bookingUrl: vars.bookingUrl };
}

function renderHtml(paragraphs, bookingUrl, unsubscribe) {
  const blocks = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      blocks.push(`<ul style="margin:0 0 18px;padding-left:20px">${list.map(item => `<li style="margin:0 0 8px">${item}</li>`).join('')}</ul>`);
      list = [];
    }
  };
  for (const paragraph of paragraphs) {
    if (paragraph.startsWith('- ')) {
      list.push(escapeHtml(paragraph.slice(2)));
      continue;
    }
    flush();
    if (paragraph === bookingUrl) {
      blocks.push(`<p style="margin:0 0 22px"><a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#078bff;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.1em;padding:14px 22px;border-radius:999px">PICK A TIME</a><br><span style="font-size:12px;color:#60605d">${escapeHtml(bookingUrl)}</span></p>`);
    } else {
      blocks.push(`<p style="margin:0 0 18px">${escapeHtml(paragraph)}</p>`);
    }
  }
  flush();
  return `<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 24px;color:#050505;background:#f8f8f4;font-size:16px;line-height:1.6">
${blocks.join('\n')}
${unsubscribe ? `<hr style="border:none;border-top:1px solid rgba(5,5,5,0.15);margin:28px 0 14px"><p style="margin:0;font-size:12px;color:#60605d">Don’t want these? <a href="${escapeHtml(unsubscribe)}" style="color:#60605d">Stop the follow-up emails</a>.</p>` : ''}
</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ---------- Send window ----------

/** Push an instant into the 8am–6pm Pacific window; later same day or next morning. */
export function adjustToSendWindow(date, window = SEND_WINDOW) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: window.timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const read = type => Number(parts.find(part => part.type === type)?.value ?? '0');
  const hour = read('hour') % 24;
  if (hour >= window.startHour && hour < window.endHour) return date;
  // Local wall-clock offset at this instant, so we can move by whole local hours.
  const localAsUtc = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'));
  const offsetMinutes = Math.round((localAsUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  const dayStartLocal = Date.UTC(read('year'), read('month') - 1, read('day'), window.startHour, 0);
  const daysAhead = hour < window.startHour ? 0 : 1;
  const target = dayStartLocal + daysAhead * 86_400_000 - offsetMinutes * 60000;
  // Re-check once in case a DST change shifted the offset overnight.
  const candidate = new Date(target);
  const candidateHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: window.timeZone, hourCycle: 'h23', hour: '2-digit' }).format(candidate)) % 24;
  return new Date(target + (window.startHour - candidateHour) * 3_600_000);
}

// ---------- Unsubscribe tokens ----------

export async function makeUnsubscribeToken(secret, leadId) {
  const signature = await hmacBase64Url(secret, `unsub:${leadId}`);
  return `${leadId}.${signature}`;
}

export async function verifyUnsubscribeToken(secret, token) {
  const match = /^(\d+)\.([A-Za-z0-9_-]{16,})$/.exec(String(token || ''));
  if (!match || !secret) return null;
  const expected = await hmacBase64Url(secret, `unsub:${match[1]}`);
  if (!timingSafeEqual(expected, match[2])) return null;
  return Number(match[1]);
}

async function hmacBase64Url(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  let binary = '';
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

// ---------- Queue ----------

/** Queue every step for a new tax lead. No-op when the sequence is disabled. */
export async function enqueueUfytEmailSequence(env, { leadId, email, now = new Date() }) {
  const config = getUfytEmailSequenceConfig(env);
  if (!config.enabled) return { queued: false, reason: 'disabled' };
  if (!email) return { queued: false, reason: 'no-email' };

  const optedOut = await env.DB.prepare(`
    SELECT 1 FROM leads WHERE email = ? COLLATE NOCASE AND email_opt_out = 1 LIMIT 1
  `).bind(email).first();
  if (optedOut) return { queued: false, reason: 'opted-out' };

  await env.DB.batch(UFYT_EMAIL_SEQUENCE.map(step => {
    const sendAt = adjustToSendWindow(new Date(now.getTime() + step.offsetHours * 3_600_000));
    return env.DB.prepare(`
      INSERT OR IGNORE INTO email_sequence (lead_id, step, send_at) VALUES (?, ?, ?)
    `).bind(leadId, step.step, sqliteDate(sendAt));
  }));
  return { queued: true, steps: UFYT_EMAIL_SEQUENCE.length };
}

export async function cancelUfytEmailSequence(env, leadId, reason) {
  const result = await env.DB.prepare(`
    UPDATE email_sequence SET status = 'cancelled', last_error = ?, updated_at = datetime('now')
    WHERE lead_id = ? AND status = 'pending'
  `).bind(reason, leadId).run();
  return result.meta?.changes ?? 0;
}

/** Send every due step. Called from the cron and the manual run endpoint. */
export async function processUfytEmailSequence(env, { limit = 50, now = new Date() } = {}) {
  const config = getUfytEmailSequenceConfig(env);
  if (!config.enabled) return { processed: 0, skipped: 'disabled' };
  if (!config.resendApiKey) return { processed: 0, skipped: 'no-resend-key' };

  const due = await env.DB.prepare(`
    SELECT s.id, s.lead_id, s.step, s.attempts,
           l.name, l.email, l.phone, l.payload_json, l.status AS lead_status,
           l.email_opt_out, l.booked_at, l.replied_at
    FROM email_sequence s JOIN leads l ON l.id = s.lead_id
    WHERE s.status = 'pending' AND s.send_at <= ?
    ORDER BY s.send_at
    LIMIT ?
  `).bind(sqliteDate(now), limit).all();

  const outcome = { processed: due.results.length, sent: 0, skipped: 0, failed: 0 };
  for (const row of due.results) {
    const result = await sendUfytEmailStep(env, config, row).catch(error => ({ status: 'failed', error: error.message }));
    outcome[result.status === 'sent' ? 'sent' : result.status === 'failed' ? 'failed' : 'skipped'] += 1;
  }
  return outcome;
}

async function sendUfytEmailStep(env, config, row) {
  const template = UFYT_EMAIL_SEQUENCE.find(step => step.step === Number(row.step));
  const email = String(row.email || '').trim();

  let skipReason = null;
  if (!template) skipReason = 'unknown-step';
  else if (!email) skipReason = 'no-email';
  else if (Number(row.email_opt_out) === 1) skipReason = 'opted-out';
  else if (row.booked_at) skipReason = 'booked';
  else if (row.replied_at) skipReason = 'replied';
  else if (row.lead_status && row.lead_status !== 'new') skipReason = `lead-${row.lead_status}`;
  if (skipReason) {
    await env.DB.prepare(`UPDATE email_sequence SET status = 'skipped', last_error = ?, updated_at = datetime('now') WHERE id = ?`).bind(skipReason, row.id).run();
    return { status: 'skipped', reason: skipReason };
  }

  const payload = parsePayload(row.payload_json);
  const lead = { id: row.lead_id, name: row.name, email, phone: row.phone, unsubscribeUrl: null };
  if (config.secret) lead.unsubscribeUrl = `${config.unsubscribeUrl}?t=${await makeUnsubscribeToken(config.secret, row.lead_id)}`;
  const rendered = renderUfytEmailStep(config, template, lead, payload);

  try {
    const result = await sendViaResend(config, {
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      unsubscribeUrl: lead.unsubscribeUrl,
      idempotencyKey: `ufyt-email-seq-${row.lead_id}-${row.step}`,
    });
    await env.DB.batch([
      env.DB.prepare(`UPDATE email_sequence SET status = 'sent', email_id = ?, attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?`).bind(result.id, row.id),
      env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'email_sent', ?)`).bind(row.lead_id, `Follow-up email ${row.step} sent: “${rendered.subject}” (${result.id})`),
    ]);
    return { status: 'sent', id: result.id };
  } catch (error) {
    const attempts = Number(row.attempts) + 1;
    const finalStatus = attempts >= 3 ? 'failed' : 'pending';
    await env.DB.prepare(`
      UPDATE email_sequence SET status = ?, attempts = ?, last_error = ?, send_at = datetime('now', '+30 minutes'), updated_at = datetime('now') WHERE id = ?
    `).bind(finalStatus, attempts, String(error.message).slice(0, 500), row.id).run();
    return { status: 'failed', error: error.message };
  }
}

async function sendViaResend(config, { to, subject, text, html, unsubscribeUrl, idempotencyKey }) {
  const headers = { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const body = { from: config.from, to: [to], reply_to: config.replyTo, subject, text, html };
  if (unsubscribeUrl) {
    body.headers = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
  const response = await fetch(`${config.resendBase}/emails`, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(`Resend ${response.status}: ${payload.message || 'rejected'}`);
  return payload;
}

// ---------- Stop signals ----------

async function findLead(env, { leadId, email }) {
  if (leadId && /^\d+$/.test(String(leadId))) {
    const lead = await env.DB.prepare(`SELECT id, name, email, phone, status FROM leads WHERE id = ?`).bind(Number(leadId)).first();
    if (lead) return lead;
  }
  if (email) {
    return env.DB.prepare(`
      SELECT id, name, email, phone, status FROM leads
      WHERE source = 'taxes' AND email = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1
    `).bind(String(email).trim()).first();
  }
  return null;
}

export async function markUfytLeadBooked(env, { leadId, email, startAt, bookingUrl, source }) {
  const lead = await findLead(env, { leadId, email });
  if (!lead) return { ok: false, reason: 'lead-not-found' };
  const when = startAt ? new Date(startAt) : null;
  const label = when && !Number.isNaN(when.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: SEND_WINDOW.timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(when)
    : 'time TBD';
  const cancelled = await cancelUfytEmailSequence(env, lead.id, 'booked');
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE leads SET booked_at = datetime('now'), booking_url = ?, next_action = ?, next_action_date = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(bookingUrl || null, `Call booked: ${label}`, when && !Number.isNaN(when.getTime()) ? when.toISOString() : null, lead.id),
    env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'call_booked', ?)`)
      .bind(lead.id, `Booked a call for ${label}${source ? ` via ${source}` : ''}${bookingUrl ? ` (${bookingUrl})` : ''}`),
  ]);
  return { ok: true, leadId: lead.id, cancelledSteps: cancelled };
}

export async function markUfytLeadBookingCancelled(env, { leadId, email, startAt }) {
  const lead = await findLead(env, { leadId, email });
  if (!lead) return { ok: false, reason: 'lead-not-found' };
  await env.DB.batch([
    env.DB.prepare(`UPDATE leads SET booked_at = NULL, booking_url = NULL, next_action = 'Call cancelled by lead', updated_at = datetime('now') WHERE id = ?`).bind(lead.id),
    env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'call_cancelled', ?)`).bind(lead.id, `Cancelled their booked call${startAt ? ` (${startAt})` : ''}`),
  ]);
  return { ok: true, leadId: lead.id };
}

export async function markUfytLeadReplied(env, { leadId, type, at }) {
  const lead = await findLead(env, { leadId });
  if (!lead) return { ok: false, reason: 'lead-not-found' };
  const cancelled = await cancelUfytEmailSequence(env, lead.id, type || 'replied');
  await env.DB.batch([
    env.DB.prepare(`UPDATE leads SET replied_at = COALESCE(replied_at, ?), updated_at = datetime('now') WHERE id = ?`).bind(at || new Date().toISOString(), lead.id),
    env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'lead_replied', ?)`).bind(lead.id, `Lead replied (${type || 'reply'}); follow-up emails stopped`),
  ]);
  return { ok: true, leadId: lead.id, cancelledSteps: cancelled };
}

export async function optOutUfytLeadEmail(env, config, token) {
  const leadId = await verifyUnsubscribeToken(config.secret, token);
  if (!leadId) return { ok: false, reason: 'invalid-token' };
  const lead = await env.DB.prepare(`SELECT id, email FROM leads WHERE id = ?`).bind(leadId).first();
  if (!lead) return { ok: false, reason: 'lead-not-found' };
  const cancelled = await cancelUfytEmailSequence(env, lead.id, 'opted-out');
  await env.DB.batch([
    env.DB.prepare(`UPDATE leads SET email_opt_out = 1, email_opt_out_at = COALESCE(email_opt_out_at, datetime('now')), updated_at = datetime('now') WHERE email = ? COLLATE NOCASE`).bind(lead.email),
    env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'email_opt_out', 'Unsubscribed from follow-up emails')`).bind(lead.id),
  ]);
  return { ok: true, leadId: lead.id, cancelledSteps: cancelled };
}

// ---------- Preview ----------

const SAMPLE_LEAD = { id: 0, name: 'Jordan Lee', email: 'jordan@example.com', phone: '(415) 555-0134', unsubscribeUrl: null };

export function previewUfytEmailSequence(config, { problem = 'owe', lead = SAMPLE_LEAD } = {}) {
  const payload = { first_name: (lead.name || '').split(' ')[0], tax_problem: {
    owe: 'I owe money to the IRS or state',
    unfiled: 'I have unfiled tax returns',
    notice: 'I received a notice from the IRS or am being audited',
    filing: 'I need help filing or organizing my taxes',
    unsure: "I'm not sure — I just know I'm f*cked",
  }[problem] || problem };
  return UFYT_EMAIL_SEQUENCE.map(template => ({
    step: template.step,
    offsetHours: template.offsetHours,
    ...renderUfytEmailStep(config, template, lead, payload),
  }));
}

/** Send the whole sequence to one inbox for review, subjects prefixed per step. */
export async function sendUfytEmailSequencePreview(env, { to, problem = 'owe', leadId = null }) {
  const config = getUfytEmailSequenceConfig(env);
  if (!config.resendApiKey) throw new Error('UFYT_RESEND_API_KEY is not set');
  let lead = { ...SAMPLE_LEAD };
  let payload = null;
  if (leadId) {
    const row = await env.DB.prepare(`SELECT id, name, email, phone, payload_json FROM leads WHERE id = ?`).bind(Number(leadId)).first();
    if (row) { lead = { id: row.id, name: row.name, email: row.email, phone: row.phone }; payload = parsePayload(row.payload_json); }
  }
  if (config.secret) lead.unsubscribeUrl = `${config.unsubscribeUrl}?t=${await makeUnsubscribeToken(config.secret, lead.id || 0)}`;
  const sent = [];
  for (const template of UFYT_EMAIL_SEQUENCE) {
    const rendered = payload
      ? renderUfytEmailStep(config, template, lead, payload)
      : previewUfytEmailSequence(config, { problem, lead }).find(item => item.step === template.step);
    const hours = template.offsetHours;
    const when = hours >= 24 ? `day ${Math.round(hours / 24)}` : `${hours}h`;
    const result = await sendViaResend(config, {
      to,
      subject: `[PREVIEW ${template.step}/${UFYT_EMAIL_SEQUENCE.length} · ${when}] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
      unsubscribeUrl: lead.unsubscribeUrl,
    });
    sent.push({ step: template.step, id: result.id, subject: rendered.subject });
  }
  return sent;
}

// ---------- HTTP handlers ----------

function isAuthorized(request, config) {
  const bearer = request.headers.get('Authorization') || '';
  return Boolean(config.secret) && bearer === `Bearer ${config.secret}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** Routes under /api/ufyt/… ; returns null when the path is not ours. */
export async function handleUfytEmailSequenceRequest(request, env, path) {
  if (!path.startsWith('/api/ufyt/')) return null;
  const config = getUfytEmailSequenceConfig(env);
  if (!isAuthorized(request, config)) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  if (request.method !== 'POST' && !(request.method === 'GET' && path === '/api/ufyt/email/preview')) {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    if (path === '/api/ufyt/email/preview' && request.method === 'GET') {
      const url = new URL(request.url);
      return jsonResponse({ success: true, emails: previewUfytEmailSequence(config, { problem: url.searchParams.get('problem') || 'owe' }) });
    }
    const body = await request.json().catch(() => ({}));
    switch (path) {
      case '/api/ufyt/booked':
        return jsonResponse({ success: true, ...(await markUfytLeadBooked(env, body)) });
      case '/api/ufyt/booking-cancelled':
        return jsonResponse({ success: true, ...(await markUfytLeadBookingCancelled(env, body)) });
      case '/api/ufyt/lead-activity':
        return jsonResponse({ success: true, ...(await markUfytLeadReplied(env, body)) });
      case '/api/ufyt/email/opt-out': {
        const result = await optOutUfytLeadEmail(env, config, body.token);
        return jsonResponse({ success: result.ok, ...result }, result.ok ? 200 : 400);
      }
      case '/api/ufyt/email/run':
        return jsonResponse({ success: true, ...(await processUfytEmailSequence(env, { limit: Number(body.limit) || 50 })) });
      case '/api/ufyt/email/preview': {
        if (!body.to || !/^[^@\s]+@[^@\s]+$/.test(body.to)) return jsonResponse({ success: false, error: 'A "to" address is required' }, 400);
        return jsonResponse({ success: true, sent: await sendUfytEmailSequencePreview(env, body) });
      }
      default:
        return jsonResponse({ success: false, error: 'Not found' }, 404);
    }
  } catch (error) {
    console.error('UFYT email sequence endpoint error:', error.message);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

// ---------- Helpers ----------

function parsePayload(json) {
  try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}

/** SQLite-friendly UTC timestamp matching datetime('now'). */
export function sqliteDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
