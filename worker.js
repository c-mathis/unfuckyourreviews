// Cloudflare Worker for Unfuck Your Reviews Lead Capture
// Handles form submissions + dashboard API

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://unfuckyourweb.com',
  'https://www.unfuckyourweb.com',
  'https://unfuckyourreviews.com',
  'https://www.unfuckyourreviews.com',
  'https://unfuckyourtaxes.com',
  'https://www.unfuckyourtaxes.com',
  'https://unfuckyourads.com',
  'https://www.unfuckyourads.com',
  'https://cmathisdigital.com',
  'https://www.cmathisdigital.com',
];

// Get CORS headers based on request origin
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Check bearer token auth for protected endpoints
function authenticate(request, env) {
  if (!env.API_TOKEN) return false;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === env.API_TOKEN;
}

// IP-based rate limiting: max 5 submissions per IP per hour
async function checkRateLimit(ip, env) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

  try {
    // Clean up expired entries and get current count
    await env.DB.prepare(
      `DELETE FROM rate_limits WHERE window_start < ?`
    ).bind(windowStart).run();

    const result = await env.DB.prepare(
      `SELECT count FROM rate_limits WHERE ip = ? AND window_start >= ?`
    ).bind(ip, windowStart).first();

    if (result && result.count >= 5) {
      return false; // Rate limited
    }

    if (result) {
      await env.DB.prepare(
        `UPDATE rate_limits SET count = count + 1 WHERE ip = ?`
      ).bind(ip).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO rate_limits (ip, count, window_start) VALUES (?, 1, ?)`
      ).bind(ip, now.toISOString()).run();
    }

    return true; // Allowed
  } catch (error) {
    // If rate_limits table doesn't exist yet, allow the request
    console.error('Rate limit check error:', error);
    return true;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Route requests — protected API endpoints
    if (path === '/api/leads' && request.method === 'GET') {
      if (!authenticate(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      return handleGetLeads(request, env, corsHeaders);
    }

    if (path === '/api/stats' && request.method === 'GET') {
      if (!authenticate(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      return handleGetStats(request, env, corsHeaders);
    }

    if (path === '/api/leads/update' && request.method === 'POST') {
      if (!authenticate(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      return handleUpdateLead(request, env, corsHeaders);
    }

    if (path === '/api/sync-communications' && request.method === 'POST') {
      const bearer = request.headers.get('Authorization') || '';
      if (!env.COMMUNICATIONS_SYNC_TOKEN || bearer !== `Bearer ${env.COMMUNICATIONS_SYNC_TOKEN}`) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      return handleCommunicationsSync(env, corsHeaders);
    }

    // Default: Form submission (POST to / or /submit) — PUBLIC
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();

      // Honeypot field — if filled, bots get a fake success
      if (data.company_url) {
        return new Response(JSON.stringify({ success: true, message: 'Lead submitted successfully' }), { status: 200, headers: corsHeaders });
      }

      // Get client IP and user agent
      const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
      const userAgent = request.headers.get('User-Agent') || '';
      const referer = request.headers.get('referer') || '';

      // Rate limiting: max 5 submissions per IP per hour
      const allowed = await checkRateLimit(clientIp, env);
      if (!allowed) {
        return new Response(JSON.stringify({ success: false, error: 'Too many submissions. Please try again later.' }), { status: 429, headers: corsHeaders });
      }

      // Determine source based on referer. The explicit source is only used as
      // a local-development fallback and is restricted to known brands.
      let source = 'unknown';
      if (referer.includes('unfuckyourweb')) source = 'web';
      else if (referer.includes('unfuckyourreviews')) source = 'reviews';
      else if (referer.includes('unfuckyourads')) source = 'ads';
      else if (referer.includes('unfuckyourtaxes')) source = 'taxes';
      else {
        const explicitSources = {
          unfuckyourweb: 'web',
          unfuckyourreviews: 'reviews',
          unfuckyourads: 'ads',
          unfuckyourtaxes: 'taxes',
          ufyt: 'taxes',
        };
        source = explicitSources[data.source] || explicitSources[data.brand] || 'unknown';
      }

      console.log('Lead submission:', { source, eventId: data.event_id || null });

      // Insert into D1 database
      const result = await env.DB.prepare(`
        INSERT INTO leads (
          source, name, email, phone, website, gbp_url, problem,
          selected_issues, issues_count,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          referrer, landing_page,
          ip_address, user_agent, brand, surface, event_id,
          triage_score, fbclid, gclid, payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        source,
        data.name,
        data.email,
        data.phone || null,
        data.website || null,
        data.gbp_url || null,
        data.problem || data.situation || null,
        data.selected_issues || null,
        parseInt(data.issues_count) || 0,
        data.utm_source || null,
        data.utm_medium || null,
        data.utm_campaign || null,
        data.utm_content || null,
        data.utm_term || null,
        data.referrer || referer || null,
        data.landing_page || null,
        clientIp,
        userAgent,
        data.brand || null,
        data.surface || null,
        data.event_id || null,
        parseInt(data.internal_triage_score) || 0,
        data.fbclid || null,
        data.gclid || null,
        JSON.stringify(data)
      ).run();

      console.log('Lead saved:', result.meta.last_row_id);

      // Internal QA submissions must never reach ad platforms, the sales
      // inbox, or SMS. They still hit D1 and email so the path can be tested.
      const isInternalTest = /\bQA TEST\b/i.test(String(data.name || '')) || data.qa_test === true;
      if (isInternalTest) console.log('Internal test submission: skipping Meta CAPI, inbox sync, and SMS');

      // Mirror UFYT leads into the Fortifi communications backend. This runs after
      // the local D1 write, is idempotent by lead ID, and never blocks the
      // public form response if the communications service is unavailable.
      if (source === 'taxes' && !isInternalTest && env.COMMUNICATIONS_INGEST_SECRET) {
        ctx.waitUntil(
          sendUfytLeadToCommunications({
            endpoint: env.COMMUNICATIONS_INGEST_URL || 'https://mathis-communications.mathisllc.workers.dev/api/integrations/leads',
            secret: env.COMMUNICATIONS_INGEST_SECRET,
            leadId: result.meta.last_row_id,
            lead: data,
          }).catch(error => console.error('UFYT communications sync error:', error.message))
        );
      }

      // Keep UFYT SMS alerts privacy-minimized and brand-scoped. The helper
      // is disabled unless every required Twilio setting is present.
      if (source === 'taxes' && !isInternalTest) {
        const smsRecipients = getUfytSmsAlertRecipients(env.UFYT_SMS_NOTIFICATION_NUMBERS);
        const smsConfigured = env.UFYT_TWILIO_ACCOUNT_SID
          && env.UFYT_TWILIO_API_KEY_SID
          && env.UFYT_TWILIO_API_KEY_SECRET
          && env.UFYT_TWILIO_MESSAGING_SERVICE_SID
          && smsRecipients.length > 0;

        if (smsConfigured) {
          ctx.waitUntil(
            sendUfytSmsLeadAlerts({
              accountSid: env.UFYT_TWILIO_ACCOUNT_SID,
              apiKeySid: env.UFYT_TWILIO_API_KEY_SID,
              apiKeySecret: env.UFYT_TWILIO_API_KEY_SECRET,
              messagingServiceSid: env.UFYT_TWILIO_MESSAGING_SERVICE_SID,
              recipients: smsRecipients,
              lead: data,
              leadId: result.meta.last_row_id,
            }).catch(error => console.error('UFYT SMS alert error:', error.message))
          );
        }
      }

      // Send Meta Conversions API event
      const metaConfig = source === 'taxes'
        ? { token: env.UFYT_META_ACCESS_TOKEN, pixelId: '1708599440630382', contentName: 'Tax Help Request' }
        : { token: env.META_ACCESS_TOKEN, pixelId: '1494351685495599', contentName: null };
      const capiSources = ['web', 'reviews', 'ads', 'taxes'];
      if (metaConfig.token && capiSources.includes(source) && !isInternalTest) {
        const contentNames = {
          web: 'Website Audit Request',
          reviews: 'Review Management Service',
          ads: 'Ads Audit Request',
          taxes: metaConfig.contentName,
        };
        ctx.waitUntil(sendMetaConversionEvent(metaConfig.token, metaConfig.pixelId, {
          eventName: 'Lead',
          eventTime: Math.floor(Date.now() / 1000),
          eventId: data.event_id || null,
          eventSourceUrl: data.landing_page || referer,
          userData: {
            email: data.email,
            phone: data.phone,
            firstName: data.first_name,
            lastName: data.last_name,
            clientIpAddress: clientIp,
            clientUserAgent: userAgent,
            fbp: data.fbp || getCookie(request, '_fbp'),
            fbc: data.fbc || getCookie(request, '_fbc') || makeFbc(data.fbclid, data.submitted_at),
          },
          customData: {
            content_name: contentNames[source] || 'Lead Form Submission',
            content_category: 'Lead Generation',
            value: 0,
            currency: 'USD',
          },
        }));
      }

      // Use a brand-scoped key for UFYT so the shared worker does not mix
      // domains or permissions across the Unfuck brand family.
      const resendApiKey = source === 'taxes' ? env.UFYT_RESEND_API_KEY : env.RESEND_API_KEY;
      if (resendApiKey) {
        // Dynamic branding based on source
        const brandConfig = {
          web: {
            name: 'Unfuck Your Web',
            fromEmail: 'leads@unfuckyourweb.com',
            replyTo: 'cameron@unfuckyourweb.com',
            subject: 'New Web Lead',
            type: 'Web Audit',
            userSubject: 'So your website is fucked?',
            userMessage: `Hey ${data.name.split(' ')[0]},

Got your submission.

I'm looking at your website right now. I've got a breakdown coming your way in about 24 hours with what's broken and how we can fix it.

I'll hit you up shortly.

To unfuckery and beyond,
— Cameron`,
          },
          reviews: {
            name: 'Unfuck Your Reviews',
            fromEmail: 'leads@unfuckyourreviews.com',
            replyTo: 'cameron@unfuckyourreviews.com',
            subject: 'New Review Lead',
            type: 'Review Management',
            userSubject: 'So your reviews are fucked?',
            userMessage: `Hey ${data.name.split(' ')[0]},

Got your submission.

I'm checking out your reviews right now. I've got a video coming your way in about 24 hours. Will breakdown the situation and how we can fix it.

I'll hit you up shortly.

To unfuckery and beyond,
— Cameron`,
          },
          ads: {
            name: 'Unfuck Your Ads',
            fromEmail: 'leads@unfuckyourads.com',
            replyTo: 'cameron@unfuckyourads.com',
            subject: 'New Ads Lead',
            type: 'Ads Management',
            userSubject: 'So your ads are fucked?',
            userMessage: `Hey ${data.name.split(' ')[0]},

Got your submission.

I'm auditing your ad accounts right now. I've got a breakdown coming your way in about 24 hours with what's wasting money and how we can fix it.

I'll hit you up shortly.

To unfuckery and beyond,
— Cameron`,
          },
          taxes: {
            name: 'Unfuck Your Taxes',
            fromEmail: 'leads@unfuckyourtaxes.com',
            replyTo: 'hello@unfuckyourtaxes.com',
            subject: 'New Tax Lead',
            type: 'Tax Relief',
            userFromName: 'Unfuck Your Taxes',
            userSubject: "Let's get your taxes in line.",
            userMessage: `Hey ${data.name.split(' ')[0]},

Looks like your taxes are in fact, f*cked.

Someone from Unf*ck Your Taxes will review and follow up within one business day.

Jokes aside, you're in good hands.

— Unf*ck Your Taxes`,
          },
        };

        const brand = brandConfig[source] || brandConfig.reviews;

        const notificationEmails = source === 'taxes' && env.UFYT_NOTIFICATION_EMAILS
          ? env.UFYT_NOTIFICATION_EMAILS.split(',').map(email => email.trim()).filter(Boolean)
          : ['cameron@axesagency.com'];

        const internalNotificationHtml = source === 'taxes'
          ? buildUfytSalesNotification(data, result.meta.last_row_id)
          : `
                <h2>New ${brand.type} Lead</h2>
                <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(data.phone || 'Not provided')}</p>
                <p><strong>Website:</strong> ${escapeHtml(data.website || 'Not provided')}</p>
                <p><strong>Problem:</strong><br>${escapeHtml(data.problem || data.situation || 'Not provided').replace(/\n/g, '<br>')}</p>
                <p><strong>Selected Issues (${parseInt(data.issues_count) || 0}):</strong> ${escapeHtml(data.selected_issues || 'None')}</p>
                <p><strong>Campaign:</strong> ${escapeHtml(data.utm_campaign || 'Direct / unknown')}</p>
                <p><strong>Source:</strong> ${escapeHtml(source)}</p>
                <p><strong>Lead ID:</strong> ${result.meta.last_row_id}</p>
              `;

        // Internal notification
        ctx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${brand.name} <${brand.fromEmail}>`,
              to: notificationEmails,
              subject: `${brand.subject}: ${data.name}`,
              html: internalNotificationHtml,
            }),
          }).then(res => logResendOutcome('Internal email', res))
            .catch(err => console.error('Internal email error:', err))
        );

        // Confirmation email to user
        ctx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${brand.userFromName || `Cameron from ${brand.name}`} <${brand.replyTo}>`,
              to: [data.email],
              reply_to: brand.replyTo,
              subject: brand.userSubject,
              text: brand.userMessage,
            }),
          }).then(res => logResendOutcome('Confirmation email', res))
            .catch(err => console.error('Confirmation email error:', err))
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead submitted successfully',
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), { status: 500, headers: corsHeaders });
    }
  }
};

// Resend answers with 4xx/5xx JSON on rejection; log it so a silently
// dropped notification is visible in the Worker tail.
async function logResendOutcome(label, response) {
  if (response.ok) {
    console.log(label + ' sent:', response.status);
    return;
  }
  const body = await response.text().catch(() => '');
  console.error(label + ' rejected:', response.status, body.slice(0, 500));
}

// ============================================
// API ENDPOINT HANDLERS
// ============================================

async function handleGetLeads(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const source = url.searchParams.get('source');
    const status = url.searchParams.get('status');

    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(
      JSON.stringify({
        success: true,
        leads: result.results,
        count: result.results.length,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Get leads error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleGetStats(request, env, corsHeaders) {
  try {
    // Total leads
    const totalResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM leads'
    ).first();

    // Leads by source
    const sourceResult = await env.DB.prepare(
      'SELECT source, COUNT(*) as count FROM leads GROUP BY source'
    ).all();

    // Leads by status
    const statusResult = await env.DB.prepare(
      'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
    ).all();

    // Today's leads
    const todayResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE DATE(created_at) = DATE('now')"
    ).first();

    // This week's leads
    const weekResult = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM leads WHERE created_at >= DATE('now', '-7 days')"
    ).first();

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: totalResult.total,
          today: todayResult.count,
          week: weekResult.count,
          by_source: sourceResult.results,
          by_status: statusResult.results,
        },
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error('Get stats error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================
// META CONVERSIONS API
// ============================================

async function sendMetaConversionEvent(accessToken, pixelId, eventData) {
  const url = `https://graph.facebook.com/v21.0/${pixelId}/events`;
  const hashedUserData = {
    em: eventData.userData.email ? [await hashSHA256(eventData.userData.email)] : undefined,
    ph: eventData.userData.phone ? [await hashSHA256(normalizePhone(eventData.userData.phone))] : undefined,
    fn: eventData.userData.firstName ? [await hashSHA256(eventData.userData.firstName)] : undefined,
    ln: eventData.userData.lastName ? [await hashSHA256(eventData.userData.lastName)] : undefined,
    client_ip_address: eventData.userData.clientIpAddress,
    client_user_agent: eventData.userData.clientUserAgent,
    fbp: eventData.userData.fbp || undefined,
    fbc: eventData.userData.fbc || undefined,
  };

  Object.keys(hashedUserData).forEach(key => hashedUserData[key] === undefined && delete hashedUserData[key]);

  const payload = {
    data: [{
      event_name: eventData.eventName,
      event_time: eventData.eventTime,
      event_id: eventData.eventId || undefined,
      event_source_url: eventData.eventSourceUrl,
      action_source: 'website',
      user_data: hashedUserData,
      custom_data: eventData.customData,
    }],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        access_token: accessToken,
      }),
    });

    const result = await response.json();
    console.log('Meta CAPI response:', result);

    if (!response.ok) {
      console.error('Meta CAPI error:', result);
    }

    return result;
  } catch (error) {
    console.error('Meta CAPI request failed:', error);
    return null;
  }
}

async function hashSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length === 10 ? `1${digits}` : digits;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function makeFbc(fbclid, submittedAt) {
  if (!fbclid) return null;
  const timestamp = submittedAt ? Date.parse(submittedAt) : Date.now();
  return `fb.1.${Number.isFinite(timestamp) ? timestamp : Date.now()}.${fbclid}`;
}

function getUfytSmsAlertRecipients(value) {
  return String(value || '')
    .split(',')
    .map(phone => phone.trim())
    .filter(phone => /^\+[1-9]\d{7,14}$/.test(phone));
}

function buildUfytSmsAlertBody(lead, leadId) {
  const name = String(lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown name').trim();
  const phone = String(lead.phone || 'No phone provided').trim();
  return `New UFYT lead: ${name}\n${phone}\nLead #${leadId}: https://ufyt-leads-dash.pages.dev`;
}

async function sendUfytLeadToCommunications(config) {
  const lead = config.lead;
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: config.leadId,
      source: 'taxes',
      name: String(lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown lead').trim(),
      email: String(lead.email || '').trim(),
      phone: lead.phone ? String(lead.phone).trim() : null,
      problem: lead.problem || lead.situation || null,
      status: 'new',
      priority: Number(lead.internal_triage_score || 0) >= 70 ? 'high' : 'medium',
      createdAt: lead.created_at || new Date().toISOString(),
      externalUrl: 'https://ufyt-leads-dash.pages.dev',
    }),
  });
  if (!response.ok) {
    throw new Error(`UFYT Inbox returned HTTP ${response.status}`);
  }
}

async function handleCommunicationsSync(env, corsHeaders) {
  if (!env.COMMUNICATIONS_INGEST_SECRET) {
    return new Response(JSON.stringify({ success: false, error: 'Communications integration is not configured' }), {
      status: 503,
      headers: corsHeaders,
    });
  }
  const result = await env.DB.prepare(`
    SELECT id, source, name, email, phone, problem, status, priority, created_at
    FROM leads
    WHERE source = 'taxes' OR brand IN ('unfuckyourtaxes', 'ufyt')
    ORDER BY id
    LIMIT 1000
  `).all();
  const endpoint = env.COMMUNICATIONS_INGEST_URL || 'https://mathis-communications.mathisllc.workers.dev/api/integrations/leads';
  let synced = 0;
  const failures = [];
  for (const lead of result.results) {
    try {
      await sendUfytLeadToCommunications({
        endpoint,
        secret: env.COMMUNICATIONS_INGEST_SECRET,
        leadId: lead.id,
        lead: {
          ...lead,
          situation: lead.problem,
          internal_triage_score: lead.priority === 'high' ? 100 : 0,
        },
      });
      synced += 1;
    } catch (error) {
      failures.push({ id: lead.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return new Response(JSON.stringify({ success: failures.length === 0, total: result.results.length, synced, failures }), {
    status: failures.length ? 502 : 200,
    headers: corsHeaders,
  });
}

async function sendUfytSmsLeadAlerts(config) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const authorization = `Basic ${btoa(`${config.apiKeySid}:${config.apiKeySecret}`)}`;
  const body = buildUfytSmsAlertBody(config.lead, config.leadId);

  return Promise.all(config.recipients.map(async recipient => {
    const form = new URLSearchParams({
      To: recipient,
      MessagingServiceSid: config.messagingServiceSid,
      Body: body,
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Twilio request failed (${response.status}, code ${result.code || 'unknown'})`);
    }

    return { sid: result.sid, status: result.status };
  }));
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildUfytSalesNotification(data, leadId) {
  const followUpFields = [
    ['debt_amount', 'Approximately how much do you owe?'],
    ['collection_actions', 'Have you received any of the following?'],
    ['unfiled_years', 'How many years are unfiled?'],
    ['self_employed', 'Are you self-employed?'],
    ['notice_type', 'What type of notice did you receive?'],
    ['notice_deadline', 'What is the deadline listed on the notice?'],
    ['filing_status', 'Are you filing as:'],
    ['refund_expectation', 'Do you expect to owe or receive a refund?'],
    ['unsure_situation', 'Which of these sounds closest to your situation?'],
    ['urgency', 'Is anything urgent?'],
    ['amount_owed', 'Amount owed'],
    ['details', 'Additional details'],
  ];
  const answerHtml = followUpFields
    .filter(([key]) => data[key] !== null && data[key] !== undefined && String(data[key]).trim() !== '')
    .map(([key, question]) => `<p><strong>${escapeHtml(question)}</strong><br>${escapeHtml(data[key])}</p>`)
    .join('');
  const taxProblem = data.tax_problem || data.problem || data.situation || 'Not provided';

  return `
    <h2>New Tax Lead</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>
    <p><strong>Phone:</strong> <a href="tel:${escapeHtml(data.phone || '')}">${escapeHtml(data.phone || 'Not provided')}</a></p>
    <hr>
    <h3>Submitted answers</h3>
    <p><strong>What’s going on with your taxes?</strong><br>${escapeHtml(taxProblem)}</p>
    ${answerHtml}
    <p><a href="https://inbox.ufyt.dev">Open this lead in the UFYT shared inbox to follow up</a></p>
    <p><small>Lead ID: ${escapeHtml(leadId)}</small></p>
  `;
}

// ============================================
// API ENDPOINT HANDLERS
// ============================================

async function handleUpdateLead(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { id, status, notes } = data;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Update lead
    const updateFields = [];
    const params = [];

    if (status) {
      updateFields.push('status = ?');
      params.push(status);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (updateFields.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No fields to update' }),
        { status: 400, headers: corsHeaders }
      );
    }

    params.push(id);
    const query = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`;

    await env.DB.prepare(query).bind(...params).run();

    // Log activity
    if (status) {
      await env.DB.prepare(`
        INSERT INTO activity_log (lead_id, activity_type, description)
        VALUES (?, 'status_change', ?)
      `).bind(id, `Status changed to: ${status}`).run();
    }

    if (notes !== undefined) {
      await env.DB.prepare(`
        INSERT INTO activity_log (lead_id, activity_type, description)
        VALUES (?, 'note_added', ?)
      `).bind(id, notes).run();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Lead updated successfully' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Update lead error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export { buildUfytSmsAlertBody, getUfytSmsAlertRecipients, sendUfytSmsLeadAlerts };
