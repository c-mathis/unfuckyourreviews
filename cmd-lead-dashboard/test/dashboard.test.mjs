import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPrivateLinkSession,
  dashboardPage,
  hasDashboardSession,
  listLeads,
  updateLead,
} from '../pages-dist/_worker.js';

const env = { DASHBOARD_LINK_TOKEN: 'dashboard-test-secret' };

test('exchanges the private-link token for a derived secure session', async () => {
  const response = await createPrivateLinkSession('dashboard-test-secret', env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), '/');
  const cookie = response.headers.get('Set-Cookie') || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /dashboard-test-secret/);

  const authenticated = await hasDashboardSession(
    new Request('https://cmd-leads-dash.pages.dev/', { headers: { Cookie: cookie.split(';')[0] } }),
    env,
  );
  assert.equal(authenticated, true);
});

test('rejects an incorrect private-link token without setting a cookie', async () => {
  const response = await createPrivateLinkSession('wrong', env);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('renders a no-store, noindex CMD lead desk', async () => {
  const response = dashboardPage();
  const html = await response.text();
  assert.match(html, /CMD Lead Desk/);
  assert.match(html, /Website inquiries and campaign leads/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('X-Robots-Tag') || '', /noindex/);
});

test('lead reads are hard-scoped to CMD', async () => {
  let query = '';
  const response = await listLeads({
    DB: { prepare(sql) { query = sql; return { all: async () => ({ results: [] }) }; } },
  });
  assert.equal(response.status, 200);
  assert.match(query, /WHERE source = 'cmd'/);
});

test('lead updates are hard-scoped to CMD and log activity', async () => {
  const statements = [];
  const DB = {
    prepare(sql) {
      const statement = { sql, values: [] };
      statements.push(statement);
      return {
        bind(...values) {
          statement.values = values;
          return { run: async () => ({ meta: { changes: 1 } }) };
        },
      };
    },
  };
  const response = await updateLead(new Request('https://dash/api/leads/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 9, status: 'contacted', notes: 'Called.' }),
  }), { DB });
  assert.equal(response.status, 200);
  assert.match(statements[0].sql, /WHERE id = \? AND source = 'cmd'/);
  assert.equal(statements[1].values[0], 9);
});
