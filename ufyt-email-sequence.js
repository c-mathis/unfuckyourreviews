// ============================================
// UFYT EMAIL FOLLOW-UP SEQUENCE
// ============================================
// Tax leads get a short follow-up sequence from Trevon after the hello@
// confirmation email. Every step points at the booking page and the
// call-or-text number. Steps stop when the lead books, replies, opts out, or
// sales moves the lead past "new". Sending happens from a cron; enqueueing
// happens at submission.
//
// Cadence (Pacific business days):
//   1  two to three hours after the quiz when that lands inside a weekday
//      08:00–17:00 window; otherwise the next business morning 08:45–10:15
//   2  day 2   } random time 09:00–15:00, weekends roll to Monday,
//   3  day 4   } never two steps on the same calendar day
//   4  day 8   }

const SEND_WINDOW = { timeZone: 'America/Los_Angeles', startHour: 8, endHour: 18 };
const TIME_ZONE = SEND_WINDOW.timeZone;

const SIGNATURE = 'Trevon Gibson\nChief Tax Unf*cker\n213-752-5732\nunfuckyourtaxes.com';

// Which of the quiz's "What's going on" answers this lead picked. Kept for the
// Lead Desk and preview tooling; the current copy does not branch on it.
const PROBLEM_KEYS = [
  [/owe money/i, 'owe'],
  [/unfiled/i, 'unfiled'],
  [/notice|audit/i, 'notice'],
  [/filing or organizing|need help filing/i, 'filing'],
];

// A body is a list of paragraphs. Strings render as paragraphs (inner "\n"
// becomes a line break); { prefix, link: true } renders the booking link.
export const UFYT_EMAIL_SEQUENCE = [
  {
    step: 1,
    label: 'same day',
    offsetDays: 0,
    subject: () => 'Unf*ck Your Taxes - About your tax problems.',
    body: ({ first, phone }) => [
      greet('Hey', first),
      `Trevon here from Unfuck Your Taxes. Let's chat so you can tell me about your tax problems.`,
      `It doesn't matter how big of a mess it is. I can help you solve it.`,
      `You don't need to prepare anything ahead of time for the call. Pretty casual.`,
      { prefix: 'Book a meeting with me here: ', link: true },
      `Or call or text me at ${phone}`,
      SIGNATURE,
    ],
  },
  {
    step: 2,
    label: 'day 2',
    offsetDays: 2,
    subject: () => "Hey It's Unf*ck Your Taxes",
    body: ({ first, phone }) => [
      greet('Hey', first),
      `How are things?`,
      `I want to make sure we talk about your taxes.`,
      `Especially if the IRS has been sending you notices.`,
      `Let's do it.`,
      { prefix: 'Book a meeting with me here: ', link: true },
      `Or call or text me at ${phone}`,
      SIGNATURE,
    ],
  },
  {
    step: 3,
    label: 'day 4',
    offsetDays: 4,
    subject: () => 'When can we chat?',
    body: ({ first, phone }) => [
      greet('Hey again', first),
      `Is there a certain time of day that works best for me to call you? Maybe that makes it easier on you.`,
      `Here to help.`,
      `Let me know.`,
      { prefix: 'Book a meeting: ', link: true },
      phone,
      SIGNATURE,
    ],
  },
  {
    step: 4,
    label: 'day 8',
    offsetDays: 8,
    subject: () => "Don't forget",
    body: ({ first, phone }) => [
      first ? `You there, ${first}?` : 'You there?',
      `I figure you're busy, so save my info for later so we can chat.`,
      `Best to take care of it. You'll be in good hands.`,
      { prefix: 'Book a meeting: ', link: true },
      phone,
      SIGNATURE,
    ],
  },
];

function greet(word, first) {
  return first ? `${word} ${first},` : `${word},`;
}

export function getUfytEmailSequenceConfig(env) {
  return {
    enabled: String(env.UFYT_EMAIL_SEQUENCE_ENABLED || '').toLowerCase() === 'true',
    resendApiKey: env.UFYT_RESEND_API_KEY || null,
    resendBase: (env.UFYT_RESEND_API_BASE || 'https://api.resend.com').replace(/\/+$/, ''),
    from: env.UFYT_EMAIL_FROM || 'Trevon Gibson <trevon@unfuckyourtaxes.com>',
    replyTo: env.UFYT_EMAIL_REPLY_TO || 'trevon@unfuckyourtaxes.com',
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

  const text = paragraphs
    .map(paragraph => (typeof paragraph === 'string' ? paragraph : `${paragraph.prefix}${vars.bookingUrl}`))
    .join('\n\n') + (unsubscribe ? `\n\nDon’t want these? ${unsubscribe}` : '');
  const html = renderHtml(paragraphs, vars, config, unsubscribe);
  return { subject, text, html, bookingUrl: vars.bookingUrl };
}

/** Plain, personal-looking HTML: no brand chrome, just paragraphs and links. */
function renderHtml(paragraphs, vars, config, unsubscribe) {
  const phoneDigits = String(config.phone).replace(/\D/g, '');
  const phoneHref = phoneDigits.length === 10 ? `tel:+1${phoneDigits}` : `tel:${phoneDigits}`;
  const linkify = escaped => escaped
    .replaceAll(escapeHtml(config.phone), `<a href="${phoneHref}" style="color:#111111">${escapeHtml(config.phone)}</a>`)
    .replaceAll('unfuckyourtaxes.com', `<a href="https://unfuckyourtaxes.com" style="color:#111111">unfuckyourtaxes.com</a>`);

  const blocks = paragraphs.map(paragraph => {
    if (typeof paragraph !== 'string') {
      const host = vars.bookingUrl.replace(/^https?:\/\//, '').split(/[/?]/)[0];
      return `<p style="margin:0 0 16px">${escapeHtml(paragraph.prefix)}<a href="${escapeHtml(vars.bookingUrl)}" style="color:#078bff">${escapeHtml(host)}</a></p>`;
    }
    return `<p style="margin:0 0 16px">${linkify(escapeHtml(paragraph)).replaceAll('\n', '<br>')}</p>`;
  });

  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#111111;font-size:16px;line-height:1.5">
${blocks.join('\n')}
${unsubscribe ? `<p style="margin:28px 0 0;font-size:12px;color:#777777">Don’t want these? <a href="${escapeHtml(unsubscribe)}" style="color:#777777">Stop the follow-up emails</a>.</p>` : ''}
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

// ---------- Scheduling ----------

function localParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value;
  return {
    year: Number(get('year')), month: Number(get('month')), day: Number(get('day')),
    hour: Number(get('hour')) % 24, minute: Number(get('minute')), weekday: get('weekday'),
  };
}

const asUtc = p => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
const DAY = 86_400_000;

/** Calendar day (UTC midnight of the Pacific date) an instant falls on. */
function calendarDayOf(date) {
  const p = localParts(date);
  return Date.UTC(p.year, p.month - 1, p.day);
}

function isWeekend(calendarDay) {
  const dow = new Date(calendarDay).getUTCDay();
  return dow === 0 || dow === 6;
}

function nextBusinessDay(calendarDay) {
  let day = calendarDay + DAY;
  while (isWeekend(day)) day += DAY;
  return day;
}

function rollToBusinessDay(calendarDay) {
  let day = calendarDay;
  while (isWeekend(day)) day += DAY;
  return day;
}

/** UTC instant for a Pacific wall-clock time on a calendar day. */
export function zonedTime(calendarDay, minutesIntoDay, timeZone = TIME_ZONE) {
  const d = new Date(calendarDay);
  const guess = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), Math.floor(minutesIntoDay / 60), minutesIntoDay % 60);
  const first = guess + (guess - asUtc(localParts(new Date(guess), timeZone)));
  // One correction pass covers a DST change between the guess and the target.
  return new Date(first + (guess - asUtc(localParts(new Date(first), timeZone))));
}

const minutes = (h, m = 0) => h * 60 + m;

function scheduleFirstStep(now, rand) {
  const local = localParts(now);
  const today = Date.UTC(local.year, local.month - 1, local.day);
  const weekday = !isWeekend(today);

  if (weekday && local.hour >= 8) {
    const candidate = new Date(now.getTime() + (120 + Math.floor(rand() * 61)) * 60_000);
    const c = localParts(candidate);
    if (calendarDayOf(candidate) === today && c.hour < 17) return candidate;
  }
  const morning = minutes(8, 45) + Math.floor(rand() * 91);
  const day = weekday && local.hour < 8 ? today : nextBusinessDay(today);
  return zonedTime(day, morning);
}

/** Send instants for every step of a lead that arrived at `now`. */
export function scheduleUfytEmailSequence(now, rand = Math.random, steps = UFYT_EMAIL_SEQUENCE) {
  const leadDay = calendarDayOf(now);
  const schedule = [];
  let lastDay = null;
  for (const step of steps) {
    let sendAt;
    if (step.step === 1) {
      sendAt = scheduleFirstStep(now, rand);
    } else {
      let day = rollToBusinessDay(leadDay + step.offsetDays * DAY);
      while (lastDay !== null && day <= lastDay) day = nextBusinessDay(day);
      sendAt = zonedTime(day, minutes(9) + Math.floor(rand() * 6 * 60));
    }
    lastDay = calendarDayOf(sendAt);
    schedule.push({ step: step.step, sendAt });
  }
  return schedule;
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

  await env.DB.batch(scheduleUfytEmailSequence(now).map(({ step, sendAt }) => env.DB.prepare(`
    INSERT OR IGNORE INTO email_sequence (lead_id, step, send_at) VALUES (?, ?, ?)
  `).bind(leadId, step, sqliteDate(sendAt))));
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

const QA_ALERT_EMAIL = 'cameron@axesagency.com';
const LEAD_DESK_URL = 'https://ufyt-leads-dash.pages.dev';
const INTERNAL_FROM = 'Unfuck Your Taxes <leads@unfuckyourtaxes.com>';
const DEFAULT_CALL_MINUTES = 30;

function isQaLead(name) {
  return /\bQA TEST\b/i.test(String(name || ''));
}

function internalRecipients(env, name) {
  if (isQaLead(name)) return [QA_ALERT_EMAIL];
  return String(env.UFYT_NOTIFICATION_EMAILS || '').split(',').map(value => value.trim()).filter(Boolean);
}

/** Merge what the booking Worker sent with what the lead record knows. */
function normalizeBooking(body, lead) {
  const start = body.startAt ? new Date(body.startAt) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const end = body.endAt ? new Date(body.endAt) : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : (validStart ? new Date(validStart.getTime() + DEFAULT_CALL_MINUTES * 60_000) : null);
  let timeZone = String(body.timeZone || '').trim() || TIME_ZONE;
  try { new Intl.DateTimeFormat('en-US', { timeZone }); } catch { timeZone = TIME_ZONE; }
  return {
    id: body.bookingId ? String(body.bookingId) : null,
    name: String(body.name || lead?.name || '').trim() || 'there',
    email: String(body.email || lead?.email || '').trim(),
    phone: String(body.phone || lead?.phone || '').trim(),
    start: validStart,
    end: validEnd,
    timeZone,
    bookingUrl: body.bookingUrl || null,
    source: body.source || null,
    notes: String(body.notes || '').trim(),
  };
}

export function formatInstant(date, timeZone) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? timeZone;
  const longDay = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' }).format(date);
  return { day, time, zone, long: `${longDay} at ${time} ${zone}` };
}

// ---------- Calendar invite ----------

const toIcsDate = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsText = value => String(value).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsParam = value => { const clean = String(value).replace(/[";:\r\n]/g, ' ').trim(); return /[,\s]/.test(clean) ? `"${clean}"` : clean; };
function foldIcsLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = []; let current = ''; let size = 0;
  for (const char of line) {
    const len = new TextEncoder().encode(char).length;
    if (size + len > (out.length ? 74 : 75)) { out.push(current); current = ' ' + char; size = 1 + len; }
    else { current += char; size += len; }
  }
  out.push(current);
  return out.join('\r\n');
}

export function buildUfytBookingIcs(booking, { organizerName, organizerEmail, phone }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Unfuck Your Taxes//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${icsText(booking.id || `${toIcsDate(booking.start)}-${booking.email}`)}@unfuckyourtaxes.com`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(booking.start)}`,
    `DTEND:${toIcsDate(booking.end)}`,
    `SUMMARY:${icsText('Call with Unf*ck Your Taxes')}`,
    `DESCRIPTION:${icsText(`Trevon calls you at ${booking.phone || 'your number'}. Need to move it? Text ${phone} or reply to your confirmation email.`)}`,
    'LOCATION:Phone call',
    `ORGANIZER;CN=${icsParam(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${icsParam(booking.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${booking.email}`,
    'STATUS:CONFIRMED', 'TRANSP:OPAQUE',
  ];
  if (booking.bookingUrl) lines.push(`URL:${icsText(booking.bookingUrl)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

function base64Encode(value) {
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function googleCalendarUrl(booking) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Call with Unf*ck Your Taxes',
    dates: `${toIcsDate(booking.start)}/${toIcsDate(booking.end)}`,
    details: `Trevon calls you at ${booking.phone || 'your number'}.`,
    location: 'Phone call',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function plainHtml(paragraphs, links = {}) {
  const blocks = paragraphs.map(paragraph => {
    let escaped = escapeHtml(paragraph).replaceAll('\n', '<br>');
    for (const [needle, href] of Object.entries(links)) {
      escaped = escaped.replaceAll(escapeHtml(needle), `<a href="${escapeHtml(href)}" style="color:#078bff">${escapeHtml(needle)}</a>`);
    }
    return `<p style="margin:0 0 16px">${escaped}</p>`;
  });
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#111111;font-size:16px;line-height:1.5">\n${blocks.join('\n')}\n</div>`;
}

/** Client-facing confirmation from Trevon, with the invite attached. */
export function buildUfytBookingConfirmation(config, booking) {
  const when = formatInstant(booking.start, booking.timeZone);
  const first = booking.name.split(/\s+/)[0] || 'there';
  const manage = booking.bookingUrl || config.bookingUrl;
  const paragraphs = [
    `${first},`,
    `You're booked. I'll call you at ${booking.phone || 'the number you gave me'} on ${when.long}.`,
    `You tell me what's going on with the IRS or state. I tell you what it takes to fix it and what it costs. No pitch, no pressure.`,
    `Have a notice or letter handy if you got one. That's the only prep.`,
    `Need to move or cancel it? Open ${manage} or text me at ${config.phone}.`,
    `Add it to Google Calendar: ${googleCalendarUrl(booking)}`,
    `A calendar invite is attached.`,
    SIGNATURE,
  ];
  const organizerEmail = (config.from.match(/<([^>]+)>/) || [])[1] || 'trevon@unfuckyourtaxes.com';
  return {
    subject: `Your call with Unf*ck Your Taxes: ${when.day} at ${when.time} ${when.zone}`,
    text: paragraphs.join('\n\n'),
    html: plainHtml(paragraphs, { [manage]: manage, [googleCalendarUrl(booking)]: googleCalendarUrl(booking), 'unfuckyourtaxes.com': 'https://unfuckyourtaxes.com' }),
    ics: buildUfytBookingIcs(booking, { organizerName: 'Trevon Gibson', organizerEmail, phone: config.phone }),
    when,
  };
}

async function postToResend(config, body, idempotencyKey) {
  const headers = { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`${config.resendBase}/emails`, { method: 'POST', headers, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(`Resend ${response.status}: ${payload.message || 'rejected'}`);
  return payload.id;
}

async function sendUfytBookingConfirmation(config, booking) {
  if (!config.resendApiKey || !booking.email || !booking.start) return null;
  const rendered = buildUfytBookingConfirmation(config, booking);
  return postToResend(config, {
    from: config.from,
    to: [booking.email],
    reply_to: config.replyTo,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    attachments: [{ filename: 'call-with-unfuck-your-taxes.ics', content: base64Encode(rendered.ics), content_type: 'text/calendar; method=REQUEST' }],
  }, booking.id ? `booking-confirm-${booking.id}` : undefined);
}

/** Tell sales a call was booked or cancelled, from the lead Worker's own key. */
async function sendUfytBookingAlert(env, config, booking, lead, kind) {
  const recipients = internalRecipients(env, booking.name);
  if (!config.resendApiKey || recipients.length === 0) return null;
  const when = booking.start ? formatInstant(booking.start, TIME_ZONE) : null;
  const verb = kind === 'booked' ? 'New call booked' : 'Call cancelled';
  const rows = [
    ['When', when ? when.long : 'time TBD'],
    ['Name', booking.name],
    ['Phone', booking.phone || 'n/a'],
    ['Email', booking.email || 'n/a'],
    ['Their time zone', booking.timeZone],
    ['Lead', lead ? `#${lead.id} ${LEAD_DESK_URL}` : 'no matching lead'],
    ['Source', booking.source || 'direct'],
    ['Notes', booking.notes || 'none'],
    ['Booking page', booking.bookingUrl || 'n/a'],
  ];
  const text = [`${verb}.`, '', ...rows.map(([label, value]) => `${label}: ${value}`), '', kind === 'booked' && lead ? 'Follow-up emails for this lead have stopped.' : ''].join('\n').trim();
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#111111;font-size:15px;line-height:1.5"><p style="margin:0 0 12px;font-weight:700">${escapeHtml(verb)}</p><table style="border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:3px 12px 3px 0;color:#666">${escapeHtml(label)}</td><td style="padding:3px 0">${escapeHtml(value)}</td></tr>`).join('')}</table></div>`;
  return postToResend(config, {
    from: INTERNAL_FROM,
    to: recipients,
    subject: `${verb}: ${booking.name}${when ? `, ${when.day} ${when.time} ${when.zone}` : ''}`,
    text,
    html,
  }, booking.id ? `booking-${kind}-alert-${booking.id}` : undefined);
}

export async function markUfytLeadBooked(env, body) {
  const config = getUfytEmailSequenceConfig(env);
  const lead = await findLead(env, { leadId: body.leadId, email: body.email });
  const booking = normalizeBooking(body, lead);
  const label = booking.start ? formatInstant(booking.start, TIME_ZONE).long : 'time TBD';

  let cancelled = 0;
  if (lead) {
    cancelled = await cancelUfytEmailSequence(env, lead.id, 'booked');
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE leads SET booked_at = datetime('now'), booking_url = ?, next_action = ?, next_action_date = ?, updated_at = datetime('now') WHERE id = ?
      `).bind(booking.bookingUrl, `Call booked: ${label}`, booking.start ? booking.start.toISOString() : null, lead.id),
      env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'call_booked', ?)`)
        .bind(lead.id, `Booked a call for ${label}${booking.source ? ` via ${booking.source}` : ''}${booking.bookingUrl ? ` (${booking.bookingUrl})` : ''}`),
    ]);
  }

  const [confirmation, alert] = await Promise.allSettled([
    sendUfytBookingConfirmation(config, booking),
    sendUfytBookingAlert(env, config, booking, lead, 'booked'),
  ]);
  if (confirmation.status === 'rejected') console.error('UFYT booking confirmation error:', confirmation.reason?.message);
  if (alert.status === 'rejected') console.error('UFYT booking alert error:', alert.reason?.message);
  if (lead && confirmation.status === 'fulfilled' && confirmation.value) {
    await env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'email_sent', ?)`)
      .bind(lead.id, `Booking confirmation sent for ${label} (${confirmation.value})`).run();
  }
  return {
    ok: true,
    leadId: lead ? lead.id : null,
    cancelledSteps: cancelled,
    emailed: confirmation.status === 'fulfilled' && Boolean(confirmation.value),
    alerted: alert.status === 'fulfilled' && Boolean(alert.value),
  };
}

export async function markUfytLeadBookingCancelled(env, body) {
  const config = getUfytEmailSequenceConfig(env);
  const lead = await findLead(env, { leadId: body.leadId, email: body.email });
  const booking = normalizeBooking(body, lead);
  if (lead) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE leads SET booked_at = NULL, booking_url = NULL, next_action = 'Call cancelled by lead', updated_at = datetime('now') WHERE id = ?`).bind(lead.id),
      env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'call_cancelled', ?)`).bind(lead.id, `Cancelled their booked call${body.startAt ? ` (${body.startAt})` : ''}`),
    ]);
  }
  const alerted = await sendUfytBookingAlert(env, config, booking, lead, 'cancelled').catch(error => { console.error('UFYT cancel alert error:', error.message); return null; });
  return { ok: true, leadId: lead ? lead.id : null, alerted: Boolean(alerted) };
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
    label: template.label,
    offsetDays: template.offsetDays,
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
    const when = template.label;
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
