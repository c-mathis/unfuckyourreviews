#!/usr/bin/env node
// Provision the UFYT tracking numbers and Messaging Service in Twilio, then
// print (or apply) the Worker secrets. Idempotent: reruns reuse what exists.
//
// Credentials are read from ~/.config/ufyt-twilio.env (KEY=value lines) or the
// environment. Required:
//   TWILIO_ACCOUNT_SID   parent or subaccount SID
//   TWILIO_AUTH_TOKEN    matching auth token
// Optional:
//   TWILIO_SUBACCOUNT_SID  provision inside this subaccount (parent creds)
//   CREATE_SUBACCOUNT      friendly name; creates a subaccount when no SID is given
//   AREA_CODE              default 916
//   WORKER_BASE            default https://leads.unfuckyourweb.com
//   FORWARD_NUMBER         E.164 sales phone (only needed for --apply-secrets)
//
// Usage: node scripts/provision-twilio.mjs [--dry-run] [--apply-secrets]

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const APPLY = args.has('--apply-secrets');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(join(homedir(), '.config', 'ufyt-twilio.env'));

const parentSid = process.env.TWILIO_ACCOUNT_SID;
const parentToken = process.env.TWILIO_AUTH_TOKEN;
if (!parentSid || !parentToken) {
  console.error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN. Put them in ~/.config/ufyt-twilio.env');
  process.exit(1);
}
const AREA_CODE = process.env.AREA_CODE || '916';
const WORKER_BASE = (process.env.WORKER_BASE || 'https://leads.unfuckyourweb.com').replace(/\/$/, '');
const NUMBERS = [
  { label: 'email-followup', friendlyName: 'UFYT email-followup' },
  { label: 'meta-ads', friendlyName: 'UFYT meta-ads' },
];

const API = 'https://api.twilio.com/2010-04-01';
const MESSAGING = 'https://messaging.twilio.com/v1';
// Starts as the parent; switches to the subaccount's own token once resolved,
// because messaging.twilio.com and Keys must be authenticated as that account.
let auth = `Basic ${Buffer.from(`${parentSid}:${parentToken}`).toString('base64')}`;

async function twilio(method, url, form) {
  const response = await fetch(url, {
    method,
    headers: { Authorization: auth, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) {
    const error = new Error(`${method} ${url} -> ${response.status}: ${data.message || text.slice(0, 200)}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

function log(step, detail) { console.log(`• ${step}${detail ? ` — ${detail}` : ''}`); }

async function resolveAccount() {
  if (process.env.TWILIO_SUBACCOUNT_SID) {
    const account = await twilio('GET', `${API}/Accounts/${process.env.TWILIO_SUBACCOUNT_SID}.json`);
    log('Using subaccount', `${account.friendly_name} (${account.sid})`);
    return account;
  }
  if (process.env.CREATE_SUBACCOUNT) {
    const existing = await twilio('GET', `${API}/Accounts.json?FriendlyName=${encodeURIComponent(process.env.CREATE_SUBACCOUNT)}&Status=active`);
    const found = (existing.accounts || []).find(a => a.friendly_name === process.env.CREATE_SUBACCOUNT);
    if (found) { log('Reusing subaccount', `${found.friendly_name} (${found.sid})`); return found; }
    if (DRY_RUN) { log('[dry-run] Would create subaccount', process.env.CREATE_SUBACCOUNT); return { sid: parentSid, auth_token: parentToken, friendly_name: '(dry-run)' }; }
    const created = await twilio('POST', `${API}/Accounts.json`, { FriendlyName: process.env.CREATE_SUBACCOUNT });
    log('Created subaccount', `${created.friendly_name} (${created.sid})`);
    return created;
  }
  const account = await twilio('GET', `${API}/Accounts/${parentSid}.json`);
  log('Using account', `${account.friendly_name} (${account.sid})`);
  return account;
}

async function ensureNumber(accountSid, spec) {
  const list = await twilio('GET', `${API}/Accounts/${accountSid}/IncomingPhoneNumbers.json?FriendlyName=${encodeURIComponent(spec.friendlyName)}&PageSize=5`);
  const webhookForm = {
    FriendlyName: spec.friendlyName,
    VoiceUrl: `${WORKER_BASE}/api/calls/voice`,
    VoiceMethod: 'POST',
    StatusCallback: `${WORKER_BASE}/api/calls/status`,
    StatusCallbackMethod: 'POST',
    SmsUrl: `${WORKER_BASE}/api/sms/inbound`,
    SmsMethod: 'POST',
  };
  const existing = (list.incoming_phone_numbers || []).find(n => n.friendly_name === spec.friendlyName);
  if (existing) {
    if (!DRY_RUN) await twilio('POST', `${API}/Accounts/${accountSid}/IncomingPhoneNumbers/${existing.sid}.json`, webhookForm);
    log(`Number for ${spec.label}`, `${existing.phone_number} (existing, webhooks ${DRY_RUN ? 'unchanged' : 'updated'})`);
    return existing;
  }
  const available = await twilio('GET', `${API}/Accounts/${accountSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${AREA_CODE}&SmsEnabled=true&VoiceEnabled=true&PageSize=5`);
  const candidate = (available.available_phone_numbers || [])[0];
  if (!candidate) throw new Error(`No local numbers available in area code ${AREA_CODE}`);
  if (DRY_RUN) { log(`[dry-run] Would buy for ${spec.label}`, candidate.phone_number); return { phone_number: candidate.phone_number, sid: 'PN_dry_run' }; }
  const bought = await twilio('POST', `${API}/Accounts/${accountSid}/IncomingPhoneNumbers.json`, { PhoneNumber: candidate.phone_number, ...webhookForm });
  log(`Bought number for ${spec.label}`, bought.phone_number);
  return bought;
}

async function ensureMessagingService(accountSid, numbers) {
  const headers = { Authorization: auth };
  const listResponse = await fetch(`${MESSAGING}/Services?PageSize=50`, { headers });
  const list = await listResponse.json();
  let service = (list.services || []).find(s => s.friendly_name === 'UFYT' && s.account_sid === accountSid);
  const form = {
    FriendlyName: 'UFYT',
    InboundRequestUrl: `${WORKER_BASE}/api/sms/inbound`,
    InboundMethod: 'POST',
    StatusCallback: `${WORKER_BASE}/api/sms/status`,
    StickySender: 'true',
    UseInboundWebhookOnNumber: 'false',
  };
  if (DRY_RUN) { log('[dry-run] Would ensure Messaging Service', service ? `existing ${service.sid}` : 'create UFYT'); return service || { sid: 'MG_dry_run' }; }
  const request = async (method, url, body) => {
    const response = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const e = new Error(`${method} ${url} -> ${response.status}: ${data.message || ''}`); e.code = data.code; throw e; }
    return data;
  };
  service = service ? await request('POST', `${MESSAGING}/Services/${service.sid}`, form) : await request('POST', `${MESSAGING}/Services`, form);
  log('Messaging Service', `${service.friendly_name} (${service.sid})`);
  for (const number of numbers) {
    try {
      await request('POST', `${MESSAGING}/Services/${service.sid}/PhoneNumbers`, { PhoneNumberSid: number.sid });
      log('Added to service', number.phone_number);
    } catch (error) {
      if (error.code === 21712 || /already/i.test(error.message)) log('Already in service', number.phone_number);
      else throw error;
    }
  }
  return service;
}

async function ensureApiKey(accountSid) {
  if (DRY_RUN) { log('[dry-run] Would create API key', 'ufyt-leads-worker'); return null; }
  const key = await twilio('POST', `${API}/Accounts/${accountSid}/Keys.json`, { FriendlyName: `ufyt-leads-worker ${new Date().toISOString().slice(0, 10)}` });
  log('Created API key', key.sid);
  return key;
}

function applySecret(name, value) {
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', name], { input: value, encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname });
  if (result.status !== 0) throw new Error(`wrangler secret put ${name} failed: ${result.stderr || result.stdout}`);
  log('Secret set', name);
}

const account = await resolveAccount();
const accountSid = account.sid;
if (account.auth_token && account.sid !== parentSid) {
  auth = `Basic ${Buffer.from(`${account.sid}:${account.auth_token}`).toString('base64')}`;
  log('Switched to subaccount credentials', account.sid);
}
const numbers = [];
for (const spec of NUMBERS) numbers.push({ ...spec, ...(await ensureNumber(accountSid, spec)) });
const service = await ensureMessagingService(accountSid, numbers);
const key = await ensureApiKey(accountSid);

const trackingMap = numbers.map(n => `${n.phone_number}=${n.label}`).join(',');
const secrets = {
  UFYT_TWILIO_ACCOUNT_SID: accountSid,
  UFYT_TWILIO_AUTH_TOKEN: account.auth_token,
  UFYT_TWILIO_MESSAGING_SERVICE_SID: service.sid,
  UFYT_TRACKING_NUMBERS: trackingMap,
  UFYT_CALL_FORWARD_NUMBER: process.env.FORWARD_NUMBER || '',
  ...(key ? { UFYT_TWILIO_API_KEY_SID: key.sid, UFYT_TWILIO_API_KEY_SECRET: key.secret } : {}),
};

console.log('\nWorker secrets:');
for (const [name, value] of Object.entries(secrets)) {
  const shown = /TOKEN|SECRET/.test(name) ? (value ? `${value.slice(0, 4)}…(${value.length})` : '(none)') : (value || '(set FORWARD_NUMBER)');
  console.log(`  ${name}=${shown}`);
}

if (!DRY_RUN) {
  const outPath = join(homedir(), '.config', 'ufyt-twilio-secrets.env');
  writeFileSync(outPath, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  chmodSync(outPath, 0o600);
  console.log(`\nSaved to ${outPath} (mode 600). Keep it out of every repo and the vault.`);
}

if (APPLY) {
  if (!secrets.UFYT_CALL_FORWARD_NUMBER) throw new Error('FORWARD_NUMBER is required for --apply-secrets');
  for (const [name, value] of Object.entries(secrets)) if (value) applySecret(name, value);
  console.log('\nAll secrets applied. Deploy the Worker next: npx wrangler deploy');
} else if (!DRY_RUN) {
  console.log('\nRe-run with --apply-secrets (and FORWARD_NUMBER set) to push these into the Worker.');
}

console.log(`\nNext in Twilio: register the Forti.fi A2P 10DLC Brand + Marketing Campaign and attach Messaging Service ${service.sid}.`);
