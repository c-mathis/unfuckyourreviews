import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  UFYT_EMAIL_SEQUENCE,
  adjustToSendWindow,
  buildBookingLink,
  firstNameFor,
  getUfytEmailSequenceConfig,
  makeUnsubscribeToken,
  previewUfytEmailSequence,
  problemKeyFor,
  renderUfytEmailStep,
  sqliteDate,
  verifyUnsubscribeToken,
} from '../ufyt-email-sequence.js';

const config = getUfytEmailSequenceConfig({ UFYT_INTEGRATION_SECRET: 'test-secret' });

test('problemKeyFor maps every quiz answer', () => {
  assert.equal(problemKeyFor({ tax_problem: 'I owe money to the IRS or state' }), 'owe');
  assert.equal(problemKeyFor({ tax_problem: 'I have unfiled tax returns' }), 'unfiled');
  assert.equal(problemKeyFor({ tax_problem: 'I received a notice from the IRS or am being audited' }), 'notice');
  assert.equal(problemKeyFor({ tax_problem: 'I need help filing or organizing my taxes' }), 'filing');
  assert.equal(problemKeyFor({ tax_problem: "I'm not sure — I just know I'm f*cked" }), 'unsure');
  assert.equal(problemKeyFor({}), 'unsure');
});

test('firstNameFor prefers the quiz first name', () => {
  assert.equal(firstNameFor({ name: 'Jordan Lee' }, { first_name: 'Jo' }), 'Jo');
  assert.equal(firstNameFor({ name: 'Jordan Lee' }, {}), 'Jordan');
  assert.equal(firstNameFor({ name: '' }, {}), '');
});

test('buildBookingLink prefills and attributes the step', () => {
  const url = new URL(buildBookingLink(config, { id: 58, name: 'Jordan Lee', email: 'jordan@example.com', phone: '(415) 555-0134' }, 2));
  assert.equal(url.origin, 'https://book.ufyt.dev');
  assert.equal(url.searchParams.get('lead'), '58');
  assert.equal(url.searchParams.get('name'), 'Jordan Lee');
  assert.equal(url.searchParams.get('email'), 'jordan@example.com');
  assert.equal(url.searchParams.get('source'), 'email-2');
});

test('adjustToSendWindow keeps 8am-6pm Pacific and defers the rest', () => {
  // 10:00 PDT stays.
  assert.equal(adjustToSendWindow(new Date('2026-09-22T17:00:00Z')).toISOString(), '2026-09-22T17:00:00.000Z');
  // 02:00 PDT moves to 08:00 PDT the same day.
  assert.equal(adjustToSendWindow(new Date('2026-09-22T09:00:00Z')).toISOString(), '2026-09-22T15:00:00.000Z');
  // 20:00 PDT moves to 08:00 PDT next day.
  assert.equal(adjustToSendWindow(new Date('2026-09-23T03:00:00Z')).toISOString(), '2026-09-23T15:00:00.000Z');
  // 20:00 PST (December) moves to 08:00 PST next day.
  assert.equal(adjustToSendWindow(new Date('2026-12-16T04:00:00Z')).toISOString(), '2026-12-16T16:00:00.000Z');
});

test('unsubscribe tokens round-trip and reject tampering', async () => {
  const token = await makeUnsubscribeToken('test-secret', 58);
  assert.match(token, /^58\.[A-Za-z0-9_-]{40,}$/);
  assert.equal(await verifyUnsubscribeToken('test-secret', token), 58);
  assert.equal(await verifyUnsubscribeToken('test-secret', token.replace('58.', '59.')), null);
  assert.equal(await verifyUnsubscribeToken('other-secret', token), null);
  assert.equal(await verifyUnsubscribeToken('test-secret', 'garbage'), null);
});

test('every step renders text and html with the booking link and unsubscribe', () => {
  const lead = { id: 58, name: 'Jordan Lee', email: 'jordan@example.com', phone: '4155550134', unsubscribeUrl: 'https://book.ufyt.dev/email/stop?t=58.abc' };
  for (const template of UFYT_EMAIL_SEQUENCE) {
    const rendered = renderUfytEmailStep(config, template, lead, { tax_problem: 'I have unfiled tax returns' });
    assert.ok(rendered.subject.length > 5, `step ${template.step} subject`);
    assert.match(rendered.text, /Hey Jordan|Jordan, quick/);
    assert.match(rendered.text, /https:\/\/book\.ufyt\.dev\?lead=58/);
    assert.match(rendered.text, /Stop|Don’t want these/);
    assert.match(rendered.html, /PICK A TIME/);
    assert.match(rendered.html, /email\/stop\?t=58\.abc/);
    assert.doesNotMatch(rendered.html, /<script/i);
  }
});

test('preview covers all problem variants without throwing', () => {
  for (const problem of ['owe', 'unfiled', 'notice', 'filing', 'unsure']) {
    const emails = previewUfytEmailSequence(config, { problem });
    assert.equal(emails.length, 4);
    assert.deepEqual(emails.map(e => e.offsetHours), [2, 26, 72, 168]);
  }
  assert.equal(previewUfytEmailSequence(config, { problem: 'notice' })[1].subject, 'About that IRS notice');
});

test('sqliteDate matches datetime(now) shape', () => {
  assert.equal(sqliteDate(new Date('2026-09-22T17:05:09.123Z')), '2026-09-22 17:05:09');
});
