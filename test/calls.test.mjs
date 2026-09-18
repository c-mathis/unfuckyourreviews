import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import worker, { computeTwilioSignature, parseTrackingNumberMap } from '../worker.js';

// Minimal D1-compatible adapter over node:sqlite so the handlers run real SQL.
function d1(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      let bound = [];
      const api = {
        bind(...params) { bound = params.map(p => (p === undefined ? null : p)); return api; },
        async run() {
          const info = statement.run(...bound);
          return { success: true, meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
        },
        async first() { return statement.get(...bound) ?? null; },
        async all() { return { success: true, results: statement.all(...bound) }; },
      };
      return api;
    },
    async batch(statements) { return Promise.all(statements.map(s => s.run())); },
  };
}

const BASE = 'https://leads.unfuckyourweb.com';
const AUTH_TOKEN = 'test-auth-token';
const FORWARD = '+19165550199';
const EMAIL_NUMBER = '+19165550100';
const META_NUMBER = '+19165550101';

let database;
let env;
let waited;
let fetchCalls;
const realFetch = globalThis.fetch;

function freshEnv() {
  database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../migrations/0003_calls.sql', import.meta.url), 'utf8'));
  return {
    DB: d1(database),
    API_TOKEN: 'dash-token',
    UFYT_TWILIO_AUTH_TOKEN: AUTH_TOKEN,
    UFYT_CALL_FORWARD_NUMBER: FORWARD,
    UFYT_TRACKING_NUMBERS: `${EMAIL_NUMBER}=email-followup,${META_NUMBER}=meta-ads`,
    UFYT_RESEND_API_KEY: 're_test',
    UFYT_NOTIFICATION_EMAILS: 'sales@example.com, second@example.com',
    COMMUNICATIONS_INGEST_SECRET: 'comms-secret',
    COMMUNICATIONS_INGEST_URL: 'https://inbox.example/api/integrations/leads',
  };
}

async function twilioPost(path, params, { sign = true, token = AUTH_TOKEN } = {}) {
  const url = `${BASE}${path}`;
  const body = new URLSearchParams(params);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (sign) headers['X-Twilio-Signature'] = await computeTwilioSignature(token, url, params);
  const request = new Request(url, { method: 'POST', headers, body: body.toString() });
  const ctx = { waitUntil(promise) { waited.push(promise); } };
  const response = await worker.fetch(request, env, ctx);
  return { response, text: await response.text() };
}

function row(sid) {
  return database.prepare('SELECT * FROM calls WHERE call_sid = ?').get(sid);
}

before(() => {
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'mock' }), { status: 200 });
  };
});
after(() => { globalThis.fetch = realFetch; });

beforeEach(() => {
  env = freshEnv();
  waited = [];
  fetchCalls = [];
});

describe('tracking number configuration', () => {
  it('parses the comma form and the JSON form', () => {
    const csv = parseTrackingNumberMap(`${EMAIL_NUMBER}=email-followup, ${META_NUMBER}=meta-ads, bogus=nope`);
    assert.equal(csv.get(EMAIL_NUMBER), 'email-followup');
    assert.equal(csv.get(META_NUMBER), 'meta-ads');
    assert.equal(csv.size, 2);
    const json = parseTrackingNumberMap(JSON.stringify({ [META_NUMBER]: 'meta-ads' }));
    assert.equal(json.get(META_NUMBER), 'meta-ads');
  });

  it('returns 503 when call tracking is not configured', async () => {
    delete env.UFYT_CALL_FORWARD_NUMBER;
    const { response } = await twilioPost('/api/calls/voice', { CallSid: 'CA1', From: '+19165551234', To: META_NUMBER });
    assert.equal(response.status, 503);
  });
});

describe('signature validation', () => {
  it('rejects an unsigned request', async () => {
    const { response } = await twilioPost('/api/calls/voice', { CallSid: 'CA1', From: '+19165551234', To: META_NUMBER }, { sign: false });
    assert.equal(response.status, 403);
    assert.equal(row('CA1'), undefined);
  });

  it('rejects a request signed with the wrong token', async () => {
    const { response } = await twilioPost('/api/calls/voice', { CallSid: 'CA1', From: '+19165551234', To: META_NUMBER }, { token: 'wrong' });
    assert.equal(response.status, 403);
  });

  it('matches the signature produced by the official twilio library', async () => {
    // Fixtures generated with twilio@5 getExpectedTwilioSignature() on 2026-09-18.
    const url = 'https://leads.unfuckyourweb.com/api/calls/dial?source=meta-ads';
    const params = { CallSid: 'CA9', DialCallStatus: 'no-answer', From: '+19165551234', To: '+19165550101', Caller: '+19165551234' };
    assert.equal(await computeTwilioSignature('test-auth-token', url, params), 'yZD+fGYV+i/7U24tngNoRCTKKGc=');
    const docUrl = 'https://mycompany.com/myapp.php?foo=1&bar=2';
    const docParams = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };
    assert.equal(await computeTwilioSignature('12345', docUrl, docParams), '0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });
});

describe('inbound call flow', () => {
  it('answers with disclosure, whisper URL, recording, and forward to the sales phone', async () => {
    const { response, text } = await twilioPost('/api/calls/voice', {
      CallSid: 'CA100', From: '+19165551234', To: META_NUMBER, CallerName: 'JANE DOE', FromCity: 'SACRAMENTO', FromState: 'CA',
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /text\/xml/);
    assert.match(text, /<Say>Thanks for calling Unfuck Your Taxes\. This call may be recorded\./);
    assert.match(text, /<Dial callerId="\+19165551234" timeout="25" answerOnBridge="true" record="record-from-answer-dual"/);
    assert.match(text, new RegExp(`recordingStatusCallback="${BASE}/api/calls/recording"`));
    assert.match(text, new RegExp(`action="${BASE}/api/calls/dial\\?source=meta-ads"`));
    assert.match(text, new RegExp(`<Number url="${BASE}/api/calls/whisper\\?source=meta-ads" method="POST">\\${FORWARD}</Number>`));

    const call = row('CA100');
    assert.equal(call.source, 'meta-ads');
    assert.equal(call.tracking_number, META_NUMBER);
    assert.equal(call.caller, '+19165551234');
    assert.equal(call.caller_name, 'JANE DOE');
    assert.equal(call.forwarded_to, FORWARD);
    assert.equal(call.status, 'in-progress');
  });

  it('uses the tracking number as caller ID when the caller is withheld', async () => {
    const { text } = await twilioPost('/api/calls/voice', { CallSid: 'CA101', From: 'anonymous', To: EMAIL_NUMBER });
    assert.match(text, new RegExp(`<Dial callerId="\\${EMAIL_NUMBER}"`));
  });

  it('tells the caller when a number is not mapped', async () => {
    const { text } = await twilioPost('/api/calls/voice', { CallSid: 'CA102', From: '+19165551234', To: '+19165550999' });
    assert.match(text, /not in service/);
    assert.match(text, /<Hangup\/>/);
  });

  it('whispers the source to the agent', async () => {
    const { text } = await twilioPost('/api/calls/whisper?source=email-followup', { CallSid: 'CA100' });
    assert.match(text, /Unfuck Your Taxes lead from the email follow up number/);
    const meta = await twilioPost('/api/calls/whisper?source=meta-ads', { CallSid: 'CA100' });
    assert.match(meta.text, /lead from the Meta ads number/);
  });

  it('hangs up quietly after an answered call and records the dial outcome', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA103', From: '+19165551234', To: META_NUMBER });
    const { text } = await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA103', DialCallStatus: 'completed', DialCallDuration: '95' });
    assert.equal(text.includes('<Say>'), false);
    assert.match(text, /<Hangup\/>/);
    assert.equal(row('CA103').answered, 1);
    assert.equal(row('CA103').dial_status, 'completed');
  });

  it('plays the missed-call message when the sales phone does not answer', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA104', From: '+19165551234', To: META_NUMBER });
    const { text } = await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA104', DialCallStatus: 'no-answer' });
    assert.match(text, /Someone from Unfuck Your Taxes will call you back/);
    assert.equal(row('CA104').answered, 0);
    assert.equal(row('CA104').dial_status, 'no-answer');
  });

  it('stores the recording when Twilio reports it', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA105', From: '+19165551234', To: META_NUMBER });
    const { response } = await twilioPost('/api/calls/recording', {
      CallSid: 'CA105', RecordingSid: 'RE1', RecordingUrl: 'https://api.twilio.com/rec/RE1', RecordingDuration: '88', RecordingStatus: 'completed',
    });
    assert.equal(response.status, 200);
    assert.equal(row('CA105').recording_url, 'https://api.twilio.com/rec/RE1');
    assert.equal(row('CA105').recording_duration_seconds, 88);
  });
});

describe('call completion and lead linking', () => {
  it('creates a phone lead for an unknown caller and links the call', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA200', From: '+19165551234', To: META_NUMBER, CallerName: 'JANE DOE' });
    await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA200', DialCallStatus: 'completed' });
    const { response, text } = await twilioPost('/api/calls/status', { CallSid: 'CA200', CallStatus: 'completed', CallDuration: '120', From: '+19165551234', To: META_NUMBER });
    assert.equal(response.status, 200);
    const body = JSON.parse(text);
    assert.equal(body.answered, true);

    const call = row('CA200');
    assert.equal(call.duration_seconds, 120);
    assert.ok(call.lead_id);
    assert.equal(call.lead_created, 1);
    const lead = database.prepare('SELECT * FROM leads WHERE id = ?').get(call.lead_id);
    assert.equal(lead.source, 'taxes');
    assert.equal(lead.name, 'JANE DOE');
    assert.equal(lead.phone, '+19165551234');
    assert.equal(lead.surface, 'phone:meta-ads');
    assert.equal(lead.email, 'phone-19165551234@calls.unfuckyourtaxes.com');
    const activity = database.prepare('SELECT * FROM activity_log WHERE lead_id = ?').all(call.lead_id);
    assert.equal(activity.length, 1);
    assert.equal(activity[0].activity_type, 'call_received');
    await Promise.all(waited);
    assert.equal(fetchCalls.length, 1, 'answered calls mirror to Communications OS without an alert');
    assert.equal(fetchCalls[0].url, 'https://inbox.example/api/integrations/calls');
    assert.equal(fetchCalls[0].init.headers.Authorization, 'Bearer comms-secret');
    const mirrored = JSON.parse(fetchCalls[0].init.body);
    assert.equal(mirrored.callSid, 'CA200');
    assert.equal(mirrored.answered, true);
    assert.equal(mirrored.outcome, 'answered');
    assert.equal(mirrored.durationSeconds, 120);
    assert.equal(mirrored.lead.id, call.lead_id);
    assert.equal(mirrored.lead.email, 'phone-19165551234@calls.unfuckyourtaxes.com');
    assert.match(mirrored.startedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.ok(row('CA200').mirrored_at);
  });

  it('links a call to an existing quiz lead that has a formatted phone number', async () => {
    database.prepare(`INSERT INTO leads (source, name, email, phone) VALUES ('taxes', 'Existing Lead', 'existing@example.com', '(916) 555-1234')`).run();
    const existingId = database.prepare('SELECT id FROM leads').get().id;
    await twilioPost('/api/calls/voice', { CallSid: 'CA201', From: '+19165551234', To: EMAIL_NUMBER });
    await twilioPost('/api/calls/dial?source=email-followup', { CallSid: 'CA201', DialCallStatus: 'completed' });
    await twilioPost('/api/calls/status', { CallSid: 'CA201', CallStatus: 'completed', CallDuration: '40', From: '+19165551234', To: EMAIL_NUMBER });
    const call = row('CA201');
    assert.equal(call.lead_id, existingId);
    assert.equal(call.lead_created, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 1);
  });

  it('sends the missed-call email alert when the sales phone did not answer', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA202', From: '+19165551234', To: META_NUMBER, FromCity: 'SACRAMENTO', FromState: 'CA' });
    await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA202', DialCallStatus: 'no-answer' });
    const { text } = await twilioPost('/api/calls/status', { CallSid: 'CA202', CallStatus: 'completed', CallDuration: '31', From: '+19165551234', To: META_NUMBER });
    assert.equal(JSON.parse(text).answered, false);
    await Promise.all(waited);
    const resend = fetchCalls.filter(f => f.url === 'https://api.resend.com/emails');
    const mirror = fetchCalls.filter(f => f.url === 'https://inbox.example/api/integrations/calls');
    assert.equal(resend.length, 1);
    assert.equal(mirror.length, 1);
    assert.equal(JSON.parse(mirror[0].init.body).outcome, 'missed (no answer)');
    const sent = JSON.parse(resend[0].init.body);
    assert.deepEqual(sent.to, ['sales@example.com', 'second@example.com']);
    assert.match(sent.subject, /Missed UFYT call: \+19165551234 \(meta-ads\)/);
    assert.match(sent.html, /missed \(no answer\)/);
    assert.match(sent.html, /SACRAMENTO, CA/);
    assert.match(sent.html, /ufyt-leads-dash\.pages\.dev/);
    assert.ok(row('CA202').alerted_at);
  });

  it('still records a call when the status callback arrives without a voice row', async () => {
    await twilioPost('/api/calls/status', { CallSid: 'CA203', CallStatus: 'no-answer', CallDuration: '0', From: '+19165557777', To: META_NUMBER });
    const call = row('CA203');
    assert.equal(call.source, 'meta-ads');
    assert.equal(call.status, 'no-answer');
    assert.ok(call.lead_id);
  });
});

describe('communications mirror', () => {
  it('re-sends the call with the recording URL when the recording arrives after completion', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA400', From: '+19165551234', To: META_NUMBER });
    await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA400', DialCallStatus: 'completed' });
    await twilioPost('/api/calls/status', { CallSid: 'CA400', CallStatus: 'completed', CallDuration: '50', From: '+19165551234', To: META_NUMBER });
    await Promise.all(waited);
    waited = [];
    fetchCalls = [];
    await twilioPost('/api/calls/recording', { CallSid: 'CA400', RecordingSid: 'RE4', RecordingUrl: 'https://api.twilio.com/rec/RE4', RecordingDuration: '48' });
    await Promise.all(waited);
    assert.equal(fetchCalls.length, 1);
    assert.equal(JSON.parse(fetchCalls[0].init.body).recordingUrl, 'https://api.twilio.com/rec/RE4');
  });

  it('skips the mirror when the Communications OS secret is absent', async () => {
    delete env.COMMUNICATIONS_INGEST_SECRET;
    await twilioPost('/api/calls/voice', { CallSid: 'CA401', From: '+19165551234', To: META_NUMBER });
    await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA401', DialCallStatus: 'completed' });
    await twilioPost('/api/calls/status', { CallSid: 'CA401', CallStatus: 'completed', CallDuration: '50', From: '+19165551234', To: META_NUMBER });
    await Promise.all(waited);
    assert.equal(fetchCalls.length, 0);
    assert.equal(row('CA401').mirrored_at, null);
  });
});

describe('dashboard endpoints', () => {
  it('requires a bearer token to list calls', async () => {
    const response = await worker.fetch(new Request(`${BASE}/api/calls`), env, { waitUntil() {} });
    assert.equal(response.status, 401);
  });

  it('lists calls with the linked lead and exposes call counts in stats', async () => {
    await twilioPost('/api/calls/voice', { CallSid: 'CA300', From: '+19165551234', To: META_NUMBER });
    await twilioPost('/api/calls/dial?source=meta-ads', { CallSid: 'CA300', DialCallStatus: 'no-answer' });
    await twilioPost('/api/calls/status', { CallSid: 'CA300', CallStatus: 'completed', CallDuration: '20', From: '+19165551234', To: META_NUMBER });
    const headers = { Authorization: 'Bearer dash-token' };
    const list = await worker.fetch(new Request(`${BASE}/api/calls?missed=1`, { headers }), env, { waitUntil() {} });
    const listBody = await list.json();
    assert.equal(list.status, 200);
    assert.equal(listBody.count, 1);
    assert.equal(listBody.calls[0].call_sid, 'CA300');
    assert.equal(listBody.calls[0].answered, 0);
    assert.ok(listBody.calls[0].lead_name);

    const stats = await worker.fetch(new Request(`${BASE}/api/stats`, { headers }), env, { waitUntil() {} });
    const statsBody = await stats.json();
    assert.equal(statsBody.stats.calls.total, 1);
    assert.equal(statsBody.stats.calls.missed_today, 1);
    assert.equal(statsBody.stats.calls.by_source[0].source, 'meta-ads');
  });
});
