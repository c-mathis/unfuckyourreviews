import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  UFYT_EMAIL_SEQUENCE,
  adjustToSendWindow,
  scheduleUfytEmailSequence,
  zonedTime,
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
    assert.match(rendered.text, /Hey Jordan|Hey again Jordan|You there, Jordan/);
    assert.match(rendered.text, /https:\/\/book\.ufyt\.dev\?lead=58/);
    assert.match(rendered.text, /Stop|Don’t want these/);
    assert.match(rendered.html, /Book a meeting.*<a href="https:\/\/book\.ufyt\.dev\?lead=58/);
    assert.match(rendered.html, /email\/stop\?t=58\.abc/);
    assert.doesNotMatch(rendered.html, /<script/i);
  }
});

test('preview covers all problem variants without throwing', () => {
  for (const problem of ['owe', 'unfiled', 'notice', 'filing', 'unsure']) {
    const emails = previewUfytEmailSequence(config, { problem });
    assert.equal(emails.length, 4);
    assert.deepEqual(emails.map(e => e.offsetDays), [0, 2, 4, 8]);
  }
  assert.deepEqual(previewUfytEmailSequence(config, { problem: 'notice' }).map(e => e.subject), ['Unf*ck Your Taxes - About your tax problems.', "Hey It's Unf*ck Your Taxes", 'When can we chat?', "Don't forget"]);
});

test('sqliteDate matches datetime(now) shape', () => {
  assert.equal(sqliteDate(new Date('2026-09-22T17:05:09.123Z')), '2026-09-22 17:05:09');
});

const fixedRand = value => () => value;
const pacific = date => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', weekday: 'short', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);

test('zonedTime maps Pacific wall clock to UTC across DST', () => {
  assert.equal(zonedTime(Date.UTC(2026, 8, 22), 9 * 60).toISOString(), '2026-09-22T16:00:00.000Z'); // PDT
  assert.equal(zonedTime(Date.UTC(2026, 11, 16), 9 * 60).toISOString(), '2026-12-16T17:00:00.000Z'); // PST
});

test('step 1 goes out two to three hours later on a weekday afternoon', () => {
  const lead = new Date('2026-09-22T17:00:00Z'); // Tue 10:00 PDT
  const [first] = scheduleUfytEmailSequence(lead, fixedRand(0.5));
  assert.equal(first.sendAt.toISOString(), '2026-09-22T19:30:00.000Z'); // 12:30 PDT
});

test('step 1 waits for the next business morning after hours and on weekends', () => {
  const late = scheduleUfytEmailSequence(new Date('2026-09-23T01:00:00Z'), fixedRand(0))[0]; // Tue 18:00 PDT
  assert.equal(pacific(late.sendAt), 'Wed, 09/23, 08:45');
  const saturday = scheduleUfytEmailSequence(new Date('2026-09-26T18:00:00Z'), fixedRand(0.99))[0]; // Sat 11:00 PDT
  assert.equal(pacific(saturday.sendAt), 'Mon, 09/28, 10:15');
  const early = scheduleUfytEmailSequence(new Date('2026-09-22T12:00:00Z'), fixedRand(0))[0]; // Tue 05:00 PDT
  assert.equal(pacific(early.sendAt), 'Tue, 09/22, 08:45');
});

test('later steps land on distinct business days between 9am and 3pm', () => {
  const lead = new Date('2026-09-24T17:00:00Z'); // Thu 10:00 PDT
  const days = scheduleUfytEmailSequence(lead, fixedRand(0)).map(item => pacific(item.sendAt));
  // day 2 = Sat -> Mon 9/28, day 4 = Mon 9/28 -> pushed to Tue 9/29, day 8 = Fri 10/2
  assert.deepEqual(days, ['Thu, 09/24, 12:00', 'Mon, 09/28, 09:00', 'Tue, 09/29, 09:00', 'Fri, 10/02, 09:00']);
  const latest = scheduleUfytEmailSequence(lead, fixedRand(0.999))[1];
  assert.equal(pacific(latest.sendAt), 'Mon, 09/28, 14:59');
});

test('emails carry the Trevon signature, the phone, and no brand chrome', () => {
  const config = getUfytEmailSequenceConfig({ UFYT_INTEGRATION_SECRET: 's' });
  for (const email of previewUfytEmailSequence(config)) {
    assert.match(email.text, /Trevon Gibson\nChief Tax Unf\*cker\n213-752-5732\nunfuckyourtaxes\.com/);
    assert.match(email.html, /tel:\+12137525732/);
    assert.match(email.html, /Book a meeting/);
    assert.doesNotMatch(email.html, /PICK A TIME|background:#f8f8f4/);
  }
});
