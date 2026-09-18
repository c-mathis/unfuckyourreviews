import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import worker, { computeTwilioSignature, classifySmsKeyword, toE164, UFYT_SMS_SEQUENCE } from '../worker.js';
import { d1, freshDatabase } from './helpers.mjs';

const BASE = 'https://leads.unfuckyourweb.com';
const AUTH_TOKEN = 'test-auth-token';
const EMAIL_NUMBER = '+19165550100';
const META_NUMBER = '+19165550101';

let database;
let env;
let waited;
let fetchCalls;
let twilioResponse;
const realFetch = globalThis.fetch;

function freshEnv() {
  database = freshDatabase();
  return {
    DB: d1(database),
    API_TOKEN: 'dash-token',
    UFYT_TWILIO_AUTH_TOKEN: AUTH_TOKEN,
    UFYT_CALL_FORWARD_NUMBER: '+19165550199',
    UFYT_TRACKING_NUMBERS: `${EMAIL_NUMBER}=email-followup,${META_NUMBER}=meta-ads`,
    UFYT_TWILIO_ACCOUNT_SID: 'ACtest',
    UFYT_TWILIO_API_KEY_SID: 'SKtest',
    UFYT_TWILIO_API_KEY_SECRET: 'secret',
    UFYT_TWILIO_MESSAGING_SERVICE_SID: 'MGtest',
    UFYT_RESEND_API_KEY: 're_test',
    UFYT_NOTIFICATION_EMAILS: 'sales@example.com',
    UFYT_SMS_NOTIFICATION_NUMBERS: '+19165550001',
    COMMUNICATIONS_INGEST_SECRET: 'comms-secret',
    COMMUNICATIONS_INGEST_URL: 'https://inbox.example/api/integrations/leads',
  };
}

const ctx = { waitUntil(promise) { waited.push(promise); } };

async function twilioPost(path, params, { sign = true } = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (sign) headers['X-Twilio-Signature'] = await computeTwilioSignature(AUTH_TOKEN, url, params);
  const request = new Request(url, { method: 'POST', headers, body: new URLSearchParams(params).toString() });
  const response = await worker.fetch(request, env, ctx);
  return { response, text: await response.text() };
}

async function submitLead(extra = {}) {
  const request = new Request(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', referer: 'https://unfuckyourtaxes.com/quiz' },
    body: JSON.stringify({
      brand: 'ufyt', source: 'unfuckyourtaxes', surface: 'quiz',
      name: 'Jane Doe', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com', phone: '(916) 555-1234',
      problem: 'Back taxes', landing_page: 'https://unfuckyourtaxes.com/quiz', event_id: 'ev1',
      ...extra,
    }),
  });
  const response = await worker.fetch(request, env, ctx);
  await Promise.all(waited);
  return response;
}

const twilioSends = () => fetchCalls.filter(f => f.url.startsWith('https://api.twilio.com/')).map(f => Object.fromEntries(new URLSearchParams(f.init.body)));
const lead = () => database.prepare('SELECT * FROM leads ORDER BY id LIMIT 1').get();
const sequence = () => database.prepare('SELECT step, status, last_error, message_sid FROM sms_sequence ORDER BY step').all();

before(() => {
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url).startsWith('https://api.twilio.com/')) {
      const body = Object.fromEntries(new URLSearchParams(init.body));
      if (twilioResponse) return twilioResponse();
      return new Response(JSON.stringify({ sid: `SM${fetchCalls.length}`, status: 'queued', from: EMAIL_NUMBER, to: body.To }), { status: 201 });
    }
    return new Response(JSON.stringify({ id: 'mock' }), { status: 200 });
  };
});
after(() => { globalThis.fetch = realFetch; });
beforeEach(() => { env = freshEnv(); waited = []; fetchCalls = []; twilioResponse = null; });

describe('helpers', () => {
  it('normalizes phones and classifies keywords', () => {
    assert.equal(toE164('(916) 555-1234'), '+19165551234');
    assert.equal(toE164('1 916 555 1234'), '+19165551234');
    assert.equal(toE164('+447700900123'), '+447700900123');
    assert.equal(toE164('12345'), null);
    assert.equal(classifySmsKeyword(' stop '), 'opt-out');
    assert.equal(classifySmsKeyword('Unsubscribe.'), 'opt-out');
    assert.equal(classifySmsKeyword('YES'), 'opt-in');
    assert.equal(classifySmsKeyword('Can you call me at 3?'), null);
  });

  it('keeps every sequence message branded with a STOP line', () => {
    for (const step of UFYT_SMS_SEQUENCE) {
      const body = step.body({ first: 'Jane' });
      assert.match(body, /Unf\*ck Your Taxes/);
      assert.match(body, /Reply STOP to opt out\.$/);
      assert.ok(body.length <= 320, `step ${step.step} is ${body.length} chars`);
    }
  });
});

describe('consent and sequence on submit', () => {
  it('does nothing without consent', async () => {
    await submitLead();
    assert.equal(lead().sms_consent, 0);
    assert.equal(sequence().length, 0);
    assert.equal(twilioSends().filter(s => s.To === '+19165551234').length, 0);
  });

  it('records consent, queues three steps, and sends step 0 immediately', async () => {
    await submitLead({ sms_consent: true, sms_consent_text: 'I agree to texts v1' });
    const row = lead();
    assert.equal(row.sms_consent, 1);
    assert.equal(row.sms_consent_text, 'I agree to texts v1');
    assert.equal(row.sms_consent_page, 'https://unfuckyourtaxes.com/quiz');
    assert.equal(row.phone, '+19165551234');
    assert.ok(row.sms_consent_at);

    const steps = sequence();
    assert.deepEqual(steps.map(s => [s.step, s.status]), [[0, 'sent'], [1, 'pending'], [2, 'pending']]);
    const sent = twilioSends().filter(s => s.To === '+19165551234');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].MessagingServiceSid, 'MGtest');
    assert.equal(sent[0].StatusCallback, 'https://leads.unfuckyourweb.com/api/sms/status');
    assert.match(sent[0].Body, /^Unf\*ck Your Taxes: got your submission, Jane\./);
    const logged = database.prepare("SELECT * FROM sms_messages WHERE direction = 'outbound'").all();
    assert.equal(logged.length, 1);
    assert.equal(logged[0].sequence_step, 0);
    assert.equal(logged[0].counterpart, '+19165551234');
  });

  it('queues but does not send when Twilio sending is not configured', async () => {
    delete env.UFYT_TWILIO_MESSAGING_SERVICE_SID;
    await submitLead({ sms_consent: 'on' });
    assert.deepEqual(sequence().map(s => s.status), ['pending', 'pending', 'pending']);
    assert.equal(twilioSends().length, 0);
  });

  it('keeps a previously opted-out phone out even when the box is ticked again', async () => {
    database.prepare("INSERT INTO leads (source, name, email, phone, sms_opt_out, sms_opt_out_at) VALUES ('taxes','Old','old@example.com','+19165551234',1,datetime('now'))").run();
    await submitLead({ sms_consent: true });
    const newest = database.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 1').get();
    assert.equal(newest.sms_opt_out, 1);
    assert.equal(sequence().length, 0);
  });
});

describe('scheduled sequence', () => {
  async function seedConsentedLead({ status = 'new' } = {}) {
    await submitLead({ sms_consent: true });
    fetchCalls = [];
    database.prepare("UPDATE sms_sequence SET send_at = datetime('now', '-1 minute') WHERE step = 1").run();
    database.prepare('UPDATE leads SET status = ?').run(status);
  }

  it('sends due steps from the cron handler', async () => {
    await seedConsentedLead();
    await worker.scheduled({}, env, ctx);
    assert.deepEqual(sequence().map(s => s.status), ['sent', 'sent', 'pending']);
    const sent = twilioSends();
    assert.equal(sent.length, 1);
    assert.match(sent[0].Body, /^Jane, it's Unf\*ck Your Taxes\./);
  });

  it('skips later steps once sales moved the lead past new', async () => {
    await seedConsentedLead({ status: 'contacted' });
    await worker.scheduled({}, env, ctx);
    assert.deepEqual(sequence().map(s => [s.status, s.last_error]), [['sent', null], ['skipped', 'lead-contacted'], ['pending', null]]);
    assert.equal(twilioSends().length, 0);
  });

  it('retries a failed send and gives up after three attempts', async () => {
    await seedConsentedLead();
    twilioResponse = () => new Response(JSON.stringify({ code: 30034, message: 'unregistered' }), { status: 400 });
    await worker.scheduled({}, env, ctx);
    let step = database.prepare('SELECT * FROM sms_sequence WHERE step = 1').get();
    assert.equal(step.status, 'pending');
    assert.equal(step.attempts, 1);
    assert.match(step.last_error, /code 30034/);
    database.prepare("UPDATE sms_sequence SET send_at = datetime('now', '-1 minute'), attempts = 2 WHERE step = 1").run();
    await worker.scheduled({}, env, ctx);
    step = database.prepare('SELECT * FROM sms_sequence WHERE step = 1').get();
    assert.equal(step.status, 'failed');
    assert.equal(step.attempts, 3);
  });

  it('exposes a protected manual run endpoint', async () => {
    await seedConsentedLead();
    const denied = await worker.fetch(new Request(`${BASE}/api/sms/run-sequence`, { method: 'POST' }), env, ctx);
    assert.equal(denied.status, 401);
    const run = await worker.fetch(new Request(`${BASE}/api/sms/run-sequence`, { method: 'POST', headers: { Authorization: 'Bearer dash-token' } }), env, ctx);
    const body = await run.json();
    assert.equal(body.sent, 1);
  });
});

describe('inbound texts', () => {
  it('rejects unsigned requests', async () => {
    const { response } = await twilioPost('/api/sms/inbound', { MessageSid: 'SM1', From: '+19165551234', To: META_NUMBER, Body: 'hi' }, { sign: false });
    assert.equal(response.status, 403);
  });

  it('logs a reply, links it to the lead, cancels the sequence, alerts, and mirrors', async () => {
    await submitLead({ sms_consent: true });
    fetchCalls = [];
    const { response, text } = await twilioPost('/api/sms/inbound', { MessageSid: 'SMin1', From: '+19165551234', To: EMAIL_NUMBER, Body: 'Call me at 3pm', NumMedia: '0', FromCity: 'SACRAMENTO', FromState: 'CA' });
    assert.equal(response.status, 200);
    assert.match(text, /<Response><\/Response>/);
    await Promise.all(waited);

    const message = database.prepare("SELECT * FROM sms_messages WHERE message_sid = 'SMin1'").get();
    assert.equal(message.direction, 'inbound');
    assert.equal(message.source, 'email-followup');
    assert.equal(message.lead_id, lead().id);
    assert.equal(message.opt_out, 0);
    assert.ok(message.alerted_at);
    assert.ok(message.mirrored_at);
    assert.deepEqual(sequence().map(s => [s.step, s.status, s.last_error]), [[0, 'sent', null], [1, 'cancelled', 'replied'], [2, 'cancelled', 'replied']]);

    const email = fetchCalls.find(f => f.url === 'https://api.resend.com/emails');
    assert.match(JSON.parse(email.init.body).subject, /New UFYT text from \+19165551234: Call me at 3pm/);
    const alertSms = twilioSends().find(s => s.To === '+19165550001');
    assert.match(alertSms.Body, /UFYT text from \+19165551234 \(email-followup\): Call me at 3pm/);
    const mirror = fetchCalls.find(f => f.url === 'https://inbox.example/api/integrations/sms');
    const mirrored = JSON.parse(mirror.init.body);
    assert.equal(mirrored.messageSid, 'SMin1');
    assert.equal(mirrored.direction, 'inbound');
    assert.equal(mirrored.body, 'Call me at 3pm');
    assert.equal(mirrored.lead.email, 'jane@example.com');
    assert.equal(database.prepare("SELECT COUNT(*) AS c FROM leads").get().c, 1);
  });

  it('opts the lead out on STOP, cancels pending steps, and does not alert', async () => {
    await submitLead({ sms_consent: true });
    fetchCalls = [];
    await twilioPost('/api/sms/inbound', { MessageSid: 'SMstop', From: '+19165551234', To: EMAIL_NUMBER, Body: 'STOP' });
    await Promise.all(waited);
    const row = lead();
    assert.equal(row.sms_opt_out, 1);
    assert.ok(row.sms_opt_out_at);
    assert.deepEqual(sequence().map(s => s.status), ['sent', 'cancelled', 'cancelled']);
    assert.equal(fetchCalls.filter(f => f.url === 'https://api.resend.com/emails').length, 0);
    assert.equal(database.prepare("SELECT opt_out FROM sms_messages WHERE message_sid = 'SMstop'").get().opt_out, 1);
    // A later cron run sends nothing.
    database.prepare("UPDATE sms_sequence SET status = 'pending', send_at = datetime('now', '-1 minute') WHERE step = 2").run();
    await worker.scheduled({}, env, ctx);
    assert.equal(twilioSends().filter(s => s.To === '+19165551234').length, 0);
    assert.equal(database.prepare('SELECT status, last_error FROM sms_sequence WHERE step = 2').get().last_error, 'opted-out');
  });

  it('creates a lead for an unknown texter', async () => {
    await twilioPost('/api/sms/inbound', { MessageSid: 'SMnew', From: '+19165557777', To: META_NUMBER, Body: 'Do you handle payroll tax?' });
    await Promise.all(waited);
    const created = database.prepare('SELECT * FROM leads').get();
    assert.equal(created.surface, 'sms:meta-ads');
    assert.equal(created.phone, '+19165557777');
    assert.equal(database.prepare("SELECT lead_id FROM sms_messages WHERE message_sid = 'SMnew'").get().lead_id, created.id);
  });

  it('records delivery status callbacks', async () => {
    await submitLead({ sms_consent: true });
    const sid = database.prepare("SELECT message_sid FROM sms_messages WHERE direction = 'outbound'").get().message_sid;
    const { response } = await twilioPost('/api/sms/status', { MessageSid: sid, MessageStatus: 'delivered' });
    assert.equal(response.status, 200);
    assert.equal(database.prepare('SELECT status FROM sms_messages WHERE message_sid = ?').get(sid).status, 'delivered');
    await twilioPost('/api/sms/status', { MessageSid: sid, MessageStatus: 'undelivered', ErrorCode: '30007' });
    const updated = database.prepare('SELECT status, error_code FROM sms_messages WHERE message_sid = ?').get(sid);
    assert.equal(updated.status, 'undelivered');
    assert.equal(updated.error_code, '30007');
  });

  it('lists messages behind the bearer token', async () => {
    await submitLead({ sms_consent: true });
    const denied = await worker.fetch(new Request(`${BASE}/api/sms`), env, ctx);
    assert.equal(denied.status, 401);
    const list = await worker.fetch(new Request(`${BASE}/api/sms`, { headers: { Authorization: 'Bearer dash-token' } }), env, ctx);
    const body = await list.json();
    assert.equal(body.count, 1);
    assert.equal(body.messages[0].lead_name, 'Jane Doe');
  });
});
