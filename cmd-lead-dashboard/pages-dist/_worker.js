const STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'];
const SESSION_COOKIE = '__Host-cmd_dashboard';
const SESSION_SECONDS = 60 * 60 * 24 * 365;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/access/') && request.method === 'GET') {
      return createPrivateLinkSession(decodeURIComponent(url.pathname.slice('/access/'.length)), env);
    }

    if (url.pathname === '/logout' && request.method === 'POST') return clearSession();

    const isApi = url.pathname.startsWith('/api/');
    if (!(await hasDashboardSession(request, env))) {
      return isApi ? json({ ok: false, error: 'Unauthorized' }, 401) : notFound();
    }

    if (url.pathname === '/' && request.method === 'GET') return dashboardPage();
    if (url.pathname === '/dashboard.css' && request.method === 'GET') return asset(DASHBOARD_CSS, 'text/css; charset=UTF-8');
    if (url.pathname === '/dashboard.js' && request.method === 'GET') return asset(DASHBOARD_JS, 'text/javascript; charset=UTF-8');
    if (url.pathname === '/api/leads' && request.method === 'GET') return listLeads(env);
    if (url.pathname === '/api/stats' && request.method === 'GET') return getStats(env);
    if (url.pathname === '/api/leads/update' && request.method === 'POST') return updateLead(request, env);
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204, headers: SECURITY_HEADERS });
    return notFound();
  },
};

function asset(body, contentType) {
  return new Response(body, { headers: { ...SECURITY_HEADERS, 'Content-Type': contentType } });
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { ...SECURITY_HEADERS, ...extraHeaders, 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

function notFound() {
  return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
}

function cookieValue(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const cookie of cookies.split(';')) {
    const [key, ...parts] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return '';
}

export async function sha256(value) {
  const input = new TextEncoder().encode(String(value));
  const buffer = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

function fixedLengthEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function expectedSession(env) {
  return sha256(`cmd-dashboard-session:${env.DASHBOARD_LINK_TOKEN}`);
}

export async function hasDashboardSession(request, env) {
  if (!env.DASHBOARD_LINK_TOKEN) return false;
  const provided = cookieValue(request, SESSION_COOKIE);
  if (!provided) return false;
  return fixedLengthEqual(provided, await expectedSession(env));
}

export async function createPrivateLinkSession(providedToken, env) {
  if (!env.DASHBOARD_LINK_TOKEN) return notFound();
  const [providedHash, expectedHash] = await Promise.all([
    sha256(providedToken),
    sha256(env.DASHBOARD_LINK_TOKEN),
  ]);
  if (!fixedLengthEqual(providedHash, expectedHash)) return notFound();

  return new Response(null, {
    status: 302,
    headers: {
      ...SECURITY_HEADERS,
      Location: '/',
      'Set-Cookie': `${SESSION_COOKIE}=${encodeURIComponent(await expectedSession(env))}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
    },
  });
}

function clearSession() {
  return json({ ok: true }, 200, {
    'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  });
}

export function dashboardPage() {
  return new Response(DASHBOARD_HTML, {
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

export async function listLeads(env) {
  const result = await env.DB.prepare(
    `SELECT id, name, email, phone, website, problem, selected_issues,
      status, notes, utm_source, utm_medium, utm_campaign, utm_content,
      landing_page, surface, payload_json, created_at, updated_at
     FROM leads
     WHERE source = 'cmd' AND duplicate_of_id IS NULL
     ORDER BY created_at DESC
     LIMIT 1000`,
  ).all();
  return json({ ok: true, leads: result.results || [] });
}

export async function getStats(env) {
  const row = await env.DB.prepare(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN status NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS open
     FROM leads
     WHERE source = 'cmd' AND duplicate_of_id IS NULL`,
  ).first();
  return json({
    ok: true,
    stats: {
      total: Number(row?.total || 0),
      today: Number(row?.today || 0),
      open: Number(row?.open || 0),
    },
  });
}

export async function updateLead(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  const id = Number(body?.id);
  const status = typeof body?.status === 'string' ? body.status : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 10000) : '';
  if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Invalid lead.' }, 400);
  if (!STATUSES.includes(status)) return json({ ok: false, error: 'Invalid status.' }, 400);

  const result = await env.DB.prepare(
    `UPDATE leads
     SET status = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ? AND source = 'cmd'`,
  ).bind(status, notes, id).run();
  if (result.meta.changes !== 1) return json({ ok: false, error: 'Lead not found.' }, 404);

  await env.DB.prepare(
    "INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'dashboard_update', ?)",
  ).bind(id, `CMD Lead Desk status: ${status}`).run();
  return json({ ok: true });
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>CMD Lead Desk</title><link rel="stylesheet" href="/dashboard.css"></head>
<body><div class="shell">
  <header class="topbar"><div class="brand"><span class="mark">CMD</span><div><strong>C. Mathis Digital</strong><small>Private lead operations</small></div></div><button id="logout" class="quiet">Sign out</button></header>
  <main>
    <section class="heading"><div><p class="eyebrow">Lead operations</p><h1>CMD Lead Desk</h1><p>Website inquiries and campaign leads, newest first.</p></div><div class="actions"><button id="refresh">Refresh</button><button id="csv" class="primary">Download CSV</button></div></section>
    <section class="stats" aria-label="Lead totals"><article><b id="total">—</b><span>Total leads</span></article><article><b id="today">—</b><span>Today</span></article><article><b id="open">—</b><span>Open</span></article></section>
    <section class="filters"><input id="search" type="search" placeholder="Search name, email, website or problem" autocomplete="off"><select id="status-filter"><option value="">All statuses</option></select></section>
    <section class="table-wrap" aria-label="CMD leads"><table><thead><tr><th>Submitted</th><th>Name</th><th>Email</th><th>Phone</th><th>Website</th><th>What’s broken</th><th>Surface</th><th>Campaign</th><th>Landing page</th><th>Status</th><th>Sales notes</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table><div class="empty" id="empty" hidden>No CMD leads match this view.</div></section>
  </main><div id="flash" class="flash" role="status" aria-live="polite"></div>
</div><script src="/dashboard.js" defer></script></body></html>`;

const DASHBOARD_CSS = `
:root{--ink:#110e15;--paper:#f5f2ee;--line:#d7d2ca;--muted:#68636e;--white:#fff;--violet:#6957ef;--lime:#dfff72}
*{box-sizing:border-box}body{margin:0;color:var(--ink);background:radial-gradient(circle at 8% 0,#f7ffbf,transparent 24%),radial-gradient(circle at 92% 0,#c8eaff,transparent 30%),var(--paper);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}.shell{min-height:100vh}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 22px;border-bottom:2px solid var(--ink);background:rgba(255,255,255,.72);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:12px}.mark{display:grid;width:48px;height:34px;place-items:center;border:2px solid var(--ink);background:var(--lime);font-size:12px;font-weight:900;letter-spacing:-.06em}.brand div{display:flex;flex-direction:column}.brand strong{font-size:14px}.brand small{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.11em}
button,input,select,textarea{font:inherit}.quiet,button{border:1.5px solid var(--ink);border-radius:0;padding:9px 12px;background:#fff;font-weight:700;cursor:pointer}.primary{color:#fff;background:var(--ink)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--violet);outline-offset:2px}
.heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:28px 28px 20px;border-bottom:2px solid var(--ink)}.eyebrow{margin:0 0 8px;text-transform:uppercase;letter-spacing:.1em;font-size:11px;font-weight:800}.heading h1{margin:0;font-size:clamp(34px,5vw,64px);line-height:.9;letter-spacing:-.055em}.heading p:last-child{margin:12px 0 0;color:var(--muted)}.actions{display:flex;gap:8px}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid var(--line);background:rgba(255,255,255,.55)}.stats article{padding:18px 28px;border-right:1px solid var(--line)}.stats article:last-child{border-right:0}.stats b{display:block;font-size:30px;letter-spacing:-.05em}.stats span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
.filters{display:flex;gap:10px;padding:14px 20px;border-bottom:1px solid var(--line);background:#fff}.filters input,.filters select{padding:10px 11px;border:1px solid var(--line);border-radius:0;background:#fff}.filters input{min-width:280px;flex:1}
.table-wrap{max-height:67vh;overflow:auto;border-bottom:1px solid var(--line);background:#fff}table{width:100%;min-width:1960px;border-collapse:separate;border-spacing:0}th{position:sticky;top:0;z-index:2;padding:9px 10px;border-right:1px solid #cec9c0;border-bottom:2px solid #a9a39a;text-align:left;white-space:nowrap;background:#e9e6e0;font-size:10px;text-transform:uppercase;letter-spacing:.06em}td{max-width:280px;padding:9px 10px;border-right:1px solid #e5e1da;border-bottom:1px solid #e5e1da;vertical-align:top;background:#fff;overflow-wrap:anywhere}tbody tr:nth-child(even) td{background:#fbfaf8}tbody tr:hover td{background:#f3f2ff}.contact a,.website a{display:block;color:#4d3fd5;text-decoration:none}.name{font-weight:750}.small{color:var(--muted);font-size:11px}.status,.notes{width:100%;border:1px solid #c8c2b8;padding:7px;background:#fff}.status{min-width:125px}.notes{width:230px;min-height:58px;resize:vertical}.save{padding:7px 10px}.empty{padding:64px 28px;text-align:center;color:var(--muted)}.flash{position:fixed;right:20px;bottom:20px;display:none;padding:11px 15px;color:#fff;background:var(--ink)}
@media(max-width:700px){.heading{align-items:flex-start;flex-direction:column}.stats{grid-template-columns:1fr}.stats article{border-right:0;border-bottom:1px solid var(--line)}.filters{flex-direction:column}.filters input{min-width:0}.table-wrap{max-height:70vh}.topbar{align-items:flex-start}.brand small{display:none}}
`;

const DASHBOARD_JS = `
const statuses=${JSON.stringify(STATUSES)};let leads=[];
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function payload(lead){try{return JSON.parse(lead.payload_json||'{}')}catch{return {}}}
function issue(lead){const data=payload(lead);return data.problem||data.situation||lead.problem||lead.selected_issues||'Not provided'}
function campaign(lead){return[lead.utm_source,lead.utm_medium,lead.utm_campaign,lead.utm_content].filter(Boolean).join(' / ')||'Direct / unknown'}
function searchable(lead){return[lead.name,lead.email,lead.phone,lead.website,issue(lead),lead.surface,campaign(lead),lead.landing_page].join(' ').toLowerCase()}
function link(value,label){if(!value)return'—';try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return esc(value);return'<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+esc(label||value)+'</a>'}catch{return esc(value)}}
function render(){const query=document.querySelector('#search').value.toLowerCase();const status=document.querySelector('#status-filter').value;const filtered=leads.filter(lead=>(!status||lead.status===status)&&(!query||searchable(lead).includes(query)));const rows=document.querySelector('#rows');rows.innerHTML='';document.querySelector('#empty').hidden=filtered.length>0;for(const lead of filtered){const row=document.createElement('tr');const options=statuses.map(item=>'<option '+(item===lead.status?'selected':'')+'>'+esc(item)+'</option>').join('');const submitted=new Date(lead.created_at+'Z');row.innerHTML='<td><b>'+esc(submitted.toLocaleDateString())+'</b><div class="small">'+esc(submitted.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))+'</div><div class="small">#'+lead.id+'</div></td><td class="name">'+esc(lead.name||'—')+'</td><td class="contact"><a href="mailto:'+encodeURIComponent(lead.email||'')+'">'+esc(lead.email||'—')+'</a></td><td class="contact">'+(lead.phone?'<a href="tel:'+encodeURIComponent(lead.phone)+'">'+esc(lead.phone)+'</a>':'—')+'</td><td class="website">'+link(lead.website,lead.website)+'</td><td>'+esc(issue(lead))+'</td><td>'+esc(lead.surface||'—')+'</td><td>'+esc(campaign(lead))+'</td><td>'+link(lead.landing_page,'Open page')+'</td><td><select class="status">'+options+'</select></td><td><textarea class="notes" placeholder="Sales notes">'+esc(lead.notes||'')+'</textarea></td><td><button class="save" data-id="'+lead.id+'">Save</button></td>';rows.appendChild(row)}document.querySelector('#csv').onclick=()=>downloadCsv(filtered)}
async function load(){const[leadResponse,statsResponse]=await Promise.all([fetch('/api/leads'),fetch('/api/stats')]);if(!leadResponse.ok||!statsResponse.ok)throw new Error('Could not load CMD leads');leads=(await leadResponse.json()).leads;const stats=(await statsResponse.json()).stats;for(const key of['total','today','open'])document.querySelector('#'+key).textContent=stats[key];render()}
document.addEventListener('click',async event=>{if(event.target.matches('.save')){const row=event.target.closest('tr');event.target.disabled=true;const response=await fetch('/api/leads/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Number(event.target.dataset.id),status:row.querySelector('.status').value,notes:row.querySelector('.notes').value})});event.target.disabled=false;flash(response.ok?'Saved':'Save failed');if(response.ok)await load()}});
function downloadCsv(items){const columns=['submitted','name','email','phone','website','problem','surface','campaign','landing_page','status','sales_notes'];const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';const records=items.map(lead=>[lead.created_at,lead.name,lead.email,lead.phone,lead.website,issue(lead),lead.surface,campaign(lead),lead.landing_page,lead.status,lead.notes]);const csv=[columns.join(','),...records.map(row=>row.map(quote).join(','))].join('\\n');const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));anchor.download='cmd-leads-'+new Date().toISOString().slice(0,10)+'.csv';anchor.click();URL.revokeObjectURL(anchor.href)}
function flash(message){const element=document.querySelector('#flash');element.textContent=message;element.style.display='block';setTimeout(()=>element.style.display='none',1800)}
document.querySelector('#search').addEventListener('input',render);document.querySelector('#status-filter').innerHTML+='<option>'+statuses.join('</option><option>')+'</option>';document.querySelector('#status-filter').addEventListener('change',render);document.querySelector('#refresh').addEventListener('click',load);document.querySelector('#logout').addEventListener('click',async()=>{await fetch('/logout',{method:'POST'});location.reload()});load().catch(error=>{document.querySelector('#empty').hidden=false;document.querySelector('#empty').textContent=error.message});
`;
