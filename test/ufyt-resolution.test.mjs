import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { database } from './d1-fixture.mjs';
import { resolutionDebt, RESOLUTION_CONSENT_VERSION, RESOLUTION_CONSENT_TEXT, processResolutionDeliveries } from '../ufyt-resolution.js';
import { enqueueUfytEmailSequence, processUfytEmailSequence } from '../ufyt-email-sequence.js';

function input(overrides = {}) {
  return { source: 'ufyt', name: 'Ada Test', first_name: 'Ada', last_name: 'Test', email: 'ada@example.com', phone: '2025550142', debt_amount: '$10,001 - $20,000',
    resolution_consent: { accepted: true, version: RESOLUTION_CONSENT_VERSION, text: RESOLUTION_CONSENT_TEXT }, ...overrides };
}
async function submit(env, data) {
  const tasks = [];
  const response = await worker.fetch(new Request('https://leads.unfuckyourweb.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Referer: 'https://unfuckyourtaxes.com/quiz' }, body: JSON.stringify(data) }), env, { waitUntil(p) { tasks.push(p); } });
  await Promise.all(tasks);
  return { response, body: await response.json() };
}
test('debt boundary keeps the entire 0–10,000 bucket with UFYT; all higher buckets qualify', () => {
  for (const debt of ['$0 - $10,000', 'Under $10k', 'No idea', '', 'Not sure']) assert.equal(resolutionDebt({ debt_amount: debt }), null);
  for (const debt of ['$10,001 - $20,000', '$20,001 - $30,000', '$400,000 - $500,000']) assert.equal(resolutionDebt({ debt_amount: debt }), debt);
  assert.equal(resolutionDebt({ amount_owed: '$10,001 - $25,000' }), '$10,001 - $25,000');
  assert.equal(resolutionDebt({ amount_owed: 'Over $100k' }), 'Over $100k');
});
test('intake atomically queues a resolution lead, no delivery until two minutes, no UFYT sequence', async () => {
  const { db, sql } = database();
  const env = { DB: db, UFYT_EMAIL_SEQUENCE_ENABLED: 'true', UFYT_RESOLUTION_ENABLED: 'true', UFYT_RESOLUTION_RELAY_SECRET: 'test', FIVE_STAR_DELIVERY: { async fetch(url, options) {
    const p = JSON.parse(options.body);
    assert.deepEqual(Object.keys(p).sort(), ['debt_amount','email','first_name','last_name','phone','transaction_id']);
    assert.equal(p.debt_amount, '$10,001 - $20,000');
    assert.ok(!options.headers.Referer);
    return Response.json({ partner_record_id: '00QVs00000hvqHHMAY' });
  } } };
  const before = Date.now();
  const { response, body } = await submit(env, input({ utm_campaign: 'UFYT_secret', landing_page: 'https://unfuckyourtaxes.com/quiz' }));
  assert.equal(response.status, 200); assert.equal(body.route, 'resolution');
  let lead = sql.prepare('SELECT * FROM leads').get();
  assert.ok(Date.parse(lead.resolution_send_after) >= before + 120000);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM email_sequence').get().n, 0);
  assert.equal((await processResolutionDeliveries(env, { now: new Date(Date.parse(lead.resolution_send_after)-1) })).processed, 0);
  assert.equal((await processResolutionDeliveries(env, { now: new Date(lead.resolution_send_after) })).delivered, 1);
  lead = sql.prepare('SELECT * FROM leads').get();
  assert.equal(lead.resolution_status, 'delivered'); assert.equal(lead.resolution_sale_status, 'pending');
  assert.equal((await processResolutionDeliveries(env, { now: new Date(Date.now()+1000000) })).processed, 0);
  assert.equal((await enqueueUfytEmailSequence(env, { leadId: lead.id, email: lead.email })).reason, 'resolution');
  const repeat = await submit(env, input({ debt_amount: '$0 - $10,000' }));
  assert.equal(repeat.body.duplicate, true); assert.equal(repeat.body.route, 'resolution');
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM leads').get().n, 1);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM repeat_acknowledgements').get().n, 0);
});
test('lower debt retains confirmation and follow-up; a repeat never exports an existing UFYT prospect', async () => {
  const { db, sql } = database(); const env = { DB: db, UFYT_EMAIL_SEQUENCE_ENABLED: 'true' };
  const first = await submit(env, input({ debt_amount: '$0 - $10,000', resolution_consent: null }));
  assert.equal(first.body.route, 'ufyt'); assert.equal(sql.prepare('SELECT COUNT(*) n FROM email_sequence').get().n, 4);
  const repeat = await submit(env, input());
  assert.equal(repeat.body.duplicate, true); assert.equal(repeat.body.route, 'ufyt');
  assert.equal(sql.prepare('SELECT resolution_status FROM leads').get().resolution_status, null);
});
test('no consent cannot create a resolution lead; QA held; retry preserves identity', async () => {
  const { db, sql } = database(); const env = { DB: db, UFYT_RESOLUTION_ENABLED: 'true' };
  assert.equal((await submit(env, input({ resolution_consent: null }))).response.status, 422);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM leads').get().n, 0);
  assert.equal((await submit(env, input({ qa_test: true }))).response.status, 200);
  assert.equal(sql.prepare('SELECT resolution_status FROM leads').get().resolution_status, 'test_hold');
});
test('temporary relay failure retries with same transaction; ambiguous delivery is held for review', async () => {
  const { db, sql } = database(); const sent = [];
  const env = { DB: db, UFYT_RESOLUTION_ENABLED: 'true', UFYT_RESOLUTION_RELAY_SECRET: 'test', FIVE_STAR_DELIVERY: { async fetch(url, options) {
    sent.push(JSON.parse(options.body).transaction_id);
    return Response.json(sent.length === 1 ? { error: 'temporarily-unavailable' } : { error: 'needs-review', review_required: true }, { status: sent.length === 1 ? 503 : 409 });
  } } };
  await submit(env, input());
  await processResolutionDeliveries(env, { now: new Date(Date.now()+120001) });
  assert.equal(sql.prepare('SELECT resolution_status FROM leads').get().resolution_status, 'pending');
  await processResolutionDeliveries(env, { now: new Date(Date.now()+180002) });
  assert.equal(sent[0], sent[1]); assert.equal(sql.prepare('SELECT resolution_status FROM leads').get().resolution_status, 'needs_review');
});
test('queued UFYT follow-up is suppressed if lead route is resolution', async () => {
  const { db, sql } = database();
  await submit({ DB: db, UFYT_RESOLUTION_ENABLED: 'true' }, input());
  sql.exec("INSERT INTO email_sequence(lead_id,step,send_at) VALUES(1,1,'2020-01-01 00:00:00')");
  const r = await processUfytEmailSequence({ DB: db, UFYT_EMAIL_SEQUENCE_ENABLED: 'true', UFYT_RESEND_API_KEY: 'test' });
  assert.equal(r.skipped, 1); assert.equal(sql.prepare('SELECT status FROM email_sequence').get().status, 'skipped');
});

test('resolution intake and repeats never send the prospect a UFYT confirmation email', async () => {
  const { db } = database();
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    messages.push(JSON.parse(options.body));
    return Response.json({ id: 'mock-email' });
  };
  try {
    const env = { DB: db, UFYT_RESOLUTION_ENABLED: 'true', UFYT_EMAIL_SEQUENCE_ENABLED: 'true', UFYT_RESEND_API_KEY: 'mock-key', UFYT_NOTIFICATION_EMAILS: 'staff@example.test' };
    assert.equal((await submit(env, input())).body.route, 'resolution');
    assert.equal((await submit(env, input())).body.duplicate, true);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].to, ['staff@example.test']);
    assert.match(messages[0].subject, /New Resolution Lead/);
    await submit(env, input({ email: 'regular@example.com', debt_amount: '$0 - $10,000', resolution_consent: null }));
    assert.equal(messages.filter(m => m.to.includes('regular@example.com')).length, 1);
    assert.equal(messages.filter(m => m.to.includes('ada@example.com')).length, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('submit-button receipt is stored, queues delivery, and rejects missing or mismatched evidence', async () => {
  const { RESOLUTION_SHORT_CONSENT_VERSION, RESOLUTION_SHORT_CONSENT_TEXT, RESOLUTION_SUBMIT_CONSENT_VERSION, RESOLUTION_SUBMIT_CONSENT_TEXT, hasResolutionConsent } = await import('../ufyt-resolution.js');
  const consent = { accepted: true, version: RESOLUTION_SHORT_CONSENT_VERSION,
    text: RESOLUTION_SHORT_CONSENT_TEXT, acceptance_method: 'form_submit',
    captured_at: new Date().toISOString(), page: 'https://unfuckyourtaxes.com/quiz' };
  assert.equal(hasResolutionConsent(input()), true, 'legacy checkbox remains supported');
  assert.equal(hasResolutionConsent({ resolution_consent: { ...consent, version: RESOLUTION_SUBMIT_CONSENT_VERSION, text: RESOLUTION_SUBMIT_CONSENT_TEXT } }), true, 'previous notice remains supported');
  for (const override of [{ accepted: false }, { acceptance_method: undefined }, { text: 'different text' }, { version: 'unknown' }, { captured_at: 'invalid' }]) {
    const { db, sql } = database();
    const result = await submit({ DB: db, UFYT_RESOLUTION_ENABLED: 'true' }, input({ resolution_consent: { ...consent, ...override } }));
    assert.equal(result.response.status, 422);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM leads').get().n, 0);
  }
  const { db, sql } = database();
  const env = { DB: db, UFYT_RESOLUTION_ENABLED: 'true', UFYT_RESOLUTION_RELAY_SECRET: 'test', FIVE_STAR_DELIVERY: {
    async fetch() { return Response.json({ partner_record_id: '00QVs00000hvqHHMAY' }); }
  } };
  const result = await submit(env, input({ resolution_consent: consent }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.route, 'resolution');
  const lead = sql.prepare('SELECT * FROM leads').get();
  assert.deepEqual(JSON.parse(lead.payload_json).resolution_consent, consent);
  assert.equal(sql.prepare('SELECT COUNT(*) n FROM email_sequence').get().n, 0);
  assert.equal((await processResolutionDeliveries(env, { now: new Date(lead.resolution_send_after) })).delivered, 1);
});
