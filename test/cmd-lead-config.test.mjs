import assert from 'node:assert/strict';
import test from 'node:test';

import { canSendMetaEvent, getMetaConfig, getNotificationEmails, resolveLeadSource } from '../lead-config.js';

test('recognizes CMD from both production hosts', () => {
  assert.equal(resolveLeadSource('https://cmathisdigital.com/website-check?utm_source=meta'), 'cmd');
  assert.equal(resolveLeadSource('https://www.cmathisdigital.com/contact'), 'cmd');
});

test('allows only the restricted CMD fallback without a production referer', () => {
  assert.equal(resolveLeadSource('', { source: 'cmd' }), 'cmd');
  assert.equal(resolveLeadSource('', { brand: 'cmathisdigital' }), 'cmd');
  assert.equal(resolveLeadSource('', { source: 'made-up-brand' }), 'unknown');
});

test('routes CMD conversions to its dedicated dataset', () => {
  const config = getMetaConfig('cmd', { META_ACCESS_TOKEN: 'shared-token' });
  assert.equal(config.pixelId, '1073785078991974');
  assert.equal(config.token, 'shared-token');
  assert.equal(config.contentName, 'CMD Website Diagnostic');
});

test('requires marketing consent for CMD CAPI events', () => {
  assert.equal(canSendMetaEvent('cmd', { marketing_consent: true }), true);
  assert.equal(canSendMetaEvent('cmd', { marketing_consent: false }), false);
  assert.equal(canSendMetaEvent('cmd', {}), false);
  assert.equal(canSendMetaEvent('unknown', { marketing_consent: true }), false);
});

test('uses a CMD-specific notification list with the established fallback', () => {
  assert.deepEqual(
    getNotificationEmails('cmd', { CMD_NOTIFICATION_EMAILS: 'cameron@example.com, ops@example.com ' }),
    ['cameron@example.com', 'ops@example.com'],
  );
  assert.deepEqual(getNotificationEmails('cmd', {}), ['cameron@axesagency.com']);
});
