import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  attendedMetaEvent,
  buildMetaEventPayload,
  normalizePurchaseEvent,
  scheduleMetaEvent,
} from '../ufyt-meta-events.js';

test('booking event names and IDs are deterministic', () => {
  const scheduled = scheduleMetaEvent({ bookingId: 'book-42', leadId: 9, eventTime: new Date('2026-10-13T08:00:00Z') });
  const attended = attendedMetaEvent({ bookingId: 'book-42', leadId: 9, eventTime: new Date('2026-10-13T09:00:00Z') });
  assert.equal(scheduled.id, 'ufyt_schedule_book-42');
  assert.equal(scheduled.eventName, 'Schedule');
  assert.equal(scheduled.eventTime, 1791878400);
  assert.equal(attended.id, 'ufyt_attended_book-42');
  assert.equal(attended.eventName, 'ConsultationAttended');
});

test('purchase events report the deposit actually paid', () => {
  const purchase = normalizePurchaseEvent({
    eventId: 'ufyt_purchase_12345678',
    orderId: 'UFYT-2026-ABC123',
    email: ' Client@Example.com ',
    name: 'Client Name',
    amountCents: 75000,
    currency: 'usd',
    paidAt: '2026-10-13T08:00:00Z',
  });
  assert.equal(purchase.email, 'client@example.com');
  assert.equal(purchase.amountCents, 75000);
  assert.equal(purchase.currency, 'USD');
});

test('purchase validation rejects malformed or missing attribution fields', () => {
  assert.throws(() => normalizePurchaseEvent({ eventId: 'short', orderId: 'x', email: 'bad', amountCents: 0 }), /event ID/);
  assert.throws(() => normalizePurchaseEvent({ eventId: 'ufyt_purchase_12345678', orderId: 'x', email: 'bad', amountCents: 100 }), /email/);
});

test('Meta payload contains match keys but no tax-case answers', async () => {
  const lead = {
    id: 9,
    name: 'Client Name',
    email: 'client@example.com',
    phone: '(213) 555-0100',
    ip_address: '203.0.113.4',
    user_agent: 'test-agent',
    fbclid: null,
    created_at: '2026-10-13 08:00:00',
    payload_json: JSON.stringify({ first_name: 'Client', last_name: 'Name', tax_problem: 'private answer', fbp: 'fb.1.1.abc' }),
  };
  const env = {
    DB: {
      prepare() {
        return { bind() { return { first: async () => lead }; } };
      },
    },
  };
  const payload = await buildMetaEventPayload(env, {
    id: 'ufyt_schedule_book-42',
    event_name: 'Schedule',
    event_time: 1791878400,
    event_source_url: 'https://book.ufyt.dev/',
    lead_id: 9,
    user_data_json: '{}',
    custom_data_json: '{"content_name":"Tax Consultation"}',
  });
  assert.deepEqual(Object.keys(payload.user_data).sort(), ['client_ip_address', 'client_user_agent', 'em', 'external_id', 'fbp', 'fn', 'ln', 'ph'].sort());
  assert.doesNotMatch(JSON.stringify(payload), /private answer|tax_problem/);
});
