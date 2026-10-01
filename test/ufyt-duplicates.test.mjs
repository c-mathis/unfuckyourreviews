import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUfytDedupeKey,
  buildUfytRepeatAcknowledgement,
  normalizeLeadEmail,
  normalizeLeadPhone,
} from '../ufyt-duplicates.js';

test('normalizes email identity without changing the submitted lead data', () => {
  assert.equal(normalizeLeadEmail('  Person@Example.COM '), 'person@example.com');
  assert.equal(buildUfytDedupeKey({ email: ' Person@Example.COM ' }), 'email:person@example.com');
});

test('uses a normalized US phone only when email is absent', () => {
  assert.equal(normalizeLeadPhone('+1 (213) 752-5732'), '2137525732');
  assert.equal(buildUfytDedupeKey({ phone: '+1 (213) 752-5732' }), 'phone:2137525732');
  assert.equal(
    buildUfytDedupeKey({ email: 'person@example.com', phone: '213-752-5732' }),
    'email:person@example.com',
  );
  assert.equal(buildUfytDedupeKey({ phone: '123' }), null);
});

test('repeat acknowledgement confirms receipt and offers booking and phone actions', () => {
  const config = {
    bookingUrl: 'https://book.ufyt.dev',
    phone: '213-752-5732',
  };
  const lead = {
    id: 42,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '213-555-0100',
  };
  const message = buildUfytRepeatAcknowledgement(config, lead);

  assert.equal(message.subject, 'We already have your information.');
  assert.match(message.text, /We already received your information\. We're looking into it\./);
  assert.match(message.text, /213-752-5732/);
  assert.match(message.bookingUrl, /^https:\/\/book\.ufyt\.dev\?/);
  assert.match(message.bookingUrl, /lead=42/);
  assert.match(message.bookingUrl, /source=email-repeat/);
  assert.match(message.html, /href="https:\/\/book\.ufyt\.dev\?/);
});
