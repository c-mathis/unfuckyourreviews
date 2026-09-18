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

    if (path === '/api/calls' && request.method === 'GET') {
      if (!authenticate(request, env)) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      return handleGetCalls(request, env, corsHeaders);
    }

    // Twilio voice webhooks for the UFYT tracking numbers (signature-verified).
    if (path.startsWith('/api/calls/')) {
      return handleCallRoute(request, env, ctx, path);
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

      // Mirror UFYT leads into the Fortifi communications backend. This runs after
      // the local D1 write, is idempotent by lead ID, and never blocks the
      // public form response if the communications service is unavailable.
      if (source === 'taxes' && env.COMMUNICATIONS_INGEST_SECRET) {
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
      if (source === 'taxes') {
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
      if (metaConfig.token && capiSources.includes(source)) {
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
          }).catch(err => console.error('Internal email error:', err))
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
          }).catch(err => console.error('Confirmation email error:', err))
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

    const callStats = await getCallStats(env);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total: totalResult.total,
          today: todayResult.count,
          week: weekResult.count,
          by_source: sourceResult.results,
          by_status: statusResult.results,
          calls: callStats,
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
  return sendUfytSms({ ...config, body: buildUfytSmsAlertBody(config.lead, config.leadId) });
}

async function sendUfytSms(config) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;
  const authorization = `Basic ${btoa(`${config.apiKeySid}:${config.apiKeySecret}`)}`;
  const body = config.body;

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

// ============================================
// CALL TRACKING (Twilio voice webhooks)
// ============================================
//
// Two static UFYT tracking numbers (email follow-up, Meta ads) forward to the
// sales phone. Every call is written to the `calls` table and linked to a lead
// by phone number. Configuration lives in Worker secrets:
//   UFYT_TWILIO_AUTH_TOKEN   subaccount auth token used to verify webhook signatures
//   UFYT_CALL_FORWARD_NUMBER E.164 sales phone the calls are bridged to
//   UFYT_TRACKING_NUMBERS    "+19165550100=email-followup,+19165550101=meta-ads" (or JSON object)
//   UFYT_CALL_GREETING       optional override for the recording disclosure

const DEFAULT_CALL_GREETING = 'Thanks for calling Unfuck Your Taxes. This call may be recorded. One moment while we connect you.';
const MISSED_CALL_MESSAGE = "Sorry, we couldn't grab that in time. Someone from Unfuck Your Taxes will call you back shortly.";
const CALL_SOURCE_SPOKEN = {
  'email-followup': 'the email follow up number',
  'meta-ads': 'the Meta ads number',
};

function isE164(value) {
  return /^\+[1-9]\d{7,14}$/.test(String(value || ''));
}

function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function parseTrackingNumberMap(value) {
  const map = new Map();
  const raw = String(value || '').trim();
  if (!raw) return map;
  if (raw.startsWith('{')) {
    try {
      for (const [number, label] of Object.entries(JSON.parse(raw))) {
        if (isE164(number) && String(label || '').trim()) map.set(number, String(label).trim());
      }
    } catch (error) {
      console.error('UFYT_TRACKING_NUMBERS JSON parse error:', error.message);
    }
    return map;
  }
  for (const entry of raw.split(',')) {
    const [number, label] = entry.split('=').map(part => (part || '').trim());
    if (isE164(number) && label) map.set(number, label);
  }
  return map;
}

function getUfytCallConfig(env) {
  const trackingNumbers = parseTrackingNumberMap(env.UFYT_TRACKING_NUMBERS);
  if (!env.UFYT_TWILIO_AUTH_TOKEN || !isE164(env.UFYT_CALL_FORWARD_NUMBER) || trackingNumbers.size === 0) {
    return null;
  }
  return {
    authToken: env.UFYT_TWILIO_AUTH_TOKEN,
    forwardTo: env.UFYT_CALL_FORWARD_NUMBER,
    trackingNumbers,
    greeting: env.UFYT_CALL_GREETING || DEFAULT_CALL_GREETING,
    dialTimeoutSeconds: 25,
  };
}

function spokenCallSource(source) {
  return CALL_SOURCE_SPOKEN[source] || String(source || 'a tracking number').replace(/[-_]+/g, ' ');
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlResponse(body, status = 200) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Twilio signs webhooks with HMAC-SHA1 over the full request URL followed by
// the POST parameters sorted by key. See
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
async function computeTwilioSignature(authToken, url, params) {
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) data += key + params[key];
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  if (a.byteLength !== b.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < a.byteLength; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function verifyTwilioSignature(request, authToken, params) {
  const supplied = request.headers.get('X-Twilio-Signature') || '';
  if (!supplied) return false;
  const url = new URL(request.url);
  // Twilio may sign the URL with or without an explicit default port.
  const candidates = [url.toString()];
  if (!url.port) {
    const withPort = new URL(url.toString());
    withPort.port = url.protocol === 'https:' ? '443' : '80';
    candidates.push(withPort.toString());
  }
  for (const candidate of candidates) {
    const expected = await computeTwilioSignature(authToken, candidate, params);
    if (constantTimeEqual(expected, supplied)) return true;
  }
  return false;
}

async function readTwilioParams(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
    return {};
  }
  const form = await request.formData();
  const params = {};
  for (const [key, value] of form.entries()) params[key] = typeof value === 'string' ? value : '';
  return params;
}

function buildVoiceTwiml({ config, source, caller, trackingNumber, baseUrl }) {
  const callerId = isE164(caller) ? caller : trackingNumber;
  const whisperUrl = `${baseUrl}/api/calls/whisper?source=${encodeURIComponent(source)}`;
  const dialActionUrl = `${baseUrl}/api/calls/dial?source=${encodeURIComponent(source)}`;
  const recordingUrl = `${baseUrl}/api/calls/recording`;
  return [
    `<Say>${escapeXml(config.greeting)}</Say>`,
    `<Dial callerId="${escapeXml(callerId)}" timeout="${config.dialTimeoutSeconds}" answerOnBridge="true"`,
    ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingUrl)}" recordingStatusCallbackEvent="completed"`,
    ` action="${escapeXml(dialActionUrl)}" method="POST">`,
    `<Number url="${escapeXml(whisperUrl)}" method="POST">${escapeXml(config.forwardTo)}</Number>`,
    `</Dial>`,
  ].join('');
}

function buildWhisperTwiml(source) {
  return `<Say>Unfuck Your Taxes lead from ${escapeXml(spokenCallSource(source))}. Connecting now.</Say>`;
}

async function upsertCallRow(env, call) {
  await env.DB.prepare(`
    INSERT INTO calls (
      call_sid, tracking_number, source, caller, caller_name, caller_city, caller_state,
      forwarded_to, status, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(call_sid) DO UPDATE SET
      status = excluded.status,
      caller = COALESCE(excluded.caller, calls.caller),
      caller_name = COALESCE(excluded.caller_name, calls.caller_name),
      caller_city = COALESCE(excluded.caller_city, calls.caller_city),
      caller_state = COALESCE(excluded.caller_state, calls.caller_state),
      forwarded_to = COALESCE(excluded.forwarded_to, calls.forwarded_to),
      payload_json = excluded.payload_json,
      updated_at = datetime('now')
  `).bind(
    call.callSid,
    call.trackingNumber,
    call.source,
    call.caller || null,
    call.callerName || null,
    call.callerCity || null,
    call.callerState || null,
    call.forwardedTo || null,
    call.status || 'initiated',
    JSON.stringify(call.payload || {})
  ).run();
}

function callerDisplayName(params) {
  const cnam = String(params.CallerName || '').trim();
  if (cnam && !/^(unknown|anonymous|unavailable)$/i.test(cnam)) return cnam;
  const digits = phoneDigits(params.From);
  if (digits.length === 11 && digits.startsWith('1')) {
    return `Phone caller (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits ? `Phone caller ${params.From}` : 'Phone caller (number withheld)';
}

// Match the caller to an existing UFYT lead by phone number, or create a new
// phone lead so the call has a home in the Lead Desk and the shared inbox.
async function linkCallToLead(env, { callSid, caller, callerName, source, callerCity, callerState }) {
  const digits = phoneDigits(caller);
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);

  const existing = await env.DB.prepare(`
    SELECT id FROM leads
    WHERE (source = 'taxes' OR brand IN ('unfuckyourtaxes', 'ufyt'))
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), '-', ''), ' ', ''), '(', ''), ')', ''), '.', ''), '+', '') LIKE ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(`%${last10}`).first();

  let leadId;
  let created = false;
  if (existing) {
    leadId = existing.id;
  } else {
    const name = callerName || `Phone caller ${caller}`;
    const insert = await env.DB.prepare(`
      INSERT INTO leads (
        source, name, email, phone, problem, brand, surface, payload_json
      ) VALUES ('taxes', ?, ?, ?, ?, 'unfuckyourtaxes', ?, ?)
    `).bind(
      name,
      `phone-${digits}@calls.unfuckyourtaxes.com`,
      caller,
      `Inbound phone call to the ${source} tracking number`,
      `phone:${source}`,
      JSON.stringify({ call_sid: callSid, source, caller_city: callerCity || null, caller_state: callerState || null })
    ).run();
    leadId = insert.meta.last_row_id;
    created = true;
  }

  await env.DB.batch([
    env.DB.prepare(`UPDATE calls SET lead_id = ?, lead_created = ?, updated_at = datetime('now') WHERE call_sid = ?`)
      .bind(leadId, created ? 1 : 0, callSid),
    env.DB.prepare(`INSERT INTO activity_log (lead_id, activity_type, description) VALUES (?, 'call_received', ?)`)
      .bind(leadId, `Inbound call via ${source} tracking number (${callSid})`),
  ]);

  return { leadId, created };
}

async function handleCallVoice(request, env, params, config) {
  const trackingNumber = String(params.To || '');
  const source = config.trackingNumbers.get(trackingNumber);
  const baseUrl = new URL(request.url).origin;
  if (!source) {
    console.error('Call to unmapped tracking number:', trackingNumber);
    return twimlResponse(`<Say>This number is not in service.</Say><Hangup/>`);
  }

  await upsertCallRow(env, {
    callSid: params.CallSid,
    trackingNumber,
    source,
    caller: isE164(params.From) ? params.From : (params.From || null),
    callerName: String(params.CallerName || '').trim() || null,
    callerCity: params.FromCity || null,
    callerState: params.FromState || null,
    forwardedTo: config.forwardTo,
    status: 'in-progress',
    payload: params,
  });

  return twimlResponse(buildVoiceTwiml({ config, source, caller: params.From, trackingNumber, baseUrl }));
}

function handleCallWhisper(request) {
  const source = new URL(request.url).searchParams.get('source') || '';
  return twimlResponse(buildWhisperTwiml(source));
}

async function handleCallDialResult(request, env, params) {
  const dialStatus = String(params.DialCallStatus || '').toLowerCase();
  const answered = dialStatus === 'completed' ? 1 : 0;
  await env.DB.prepare(`
    UPDATE calls SET dial_status = ?, answered = ?, updated_at = datetime('now') WHERE call_sid = ?
  `).bind(dialStatus || null, answered, params.CallSid).run();

  if (answered) return twimlResponse('<Hangup/>');
  return twimlResponse(`<Say>${escapeXml(MISSED_CALL_MESSAGE)}</Say><Hangup/>`);
}

async function handleCallStatus(request, env, ctx, params, config) {
  const callSid = params.CallSid;
  const status = String(params.CallStatus || '').toLowerCase();
  const trackingNumber = String(params.To || '');
  const source = config.trackingNumbers.get(trackingNumber) || 'unknown';

  // The status callback can arrive before or without the voice webhook row, so
  // make sure a row exists before finalizing it.
  await upsertCallRow(env, {
    callSid,
    trackingNumber,
    source,
    caller: isE164(params.From) ? params.From : (params.From || null),
    callerName: String(params.CallerName || '').trim() || null,
    callerCity: params.FromCity || null,
    callerState: params.FromState || null,
    forwardedTo: config.forwardTo,
    status: status || 'completed',
    payload: params,
  });

  const terminal = ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status);
  if (!terminal) {
    return new Response(JSON.stringify({ success: true, status }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  await env.DB.prepare(`
    UPDATE calls
    SET duration_seconds = ?, ended_at = datetime('now'), updated_at = datetime('now')
    WHERE call_sid = ?
  `).bind(parseInt(params.CallDuration) || 0, callSid).run();

  const row = await env.DB.prepare(`SELECT * FROM calls WHERE call_sid = ?`).bind(callSid).first();
  let link = null;
  if (row && !row.lead_id) {
    link = await linkCallToLead(env, {
      callSid,
      caller: row.caller,
      callerName: row.caller_name,
      source: row.source,
      callerCity: row.caller_city,
      callerState: row.caller_state,
    }).catch(error => {
      console.error('Call lead link error:', error.message);
      return null;
    });
  }
  const leadId = link ? link.leadId : (row ? row.lead_id : null);
  const answered = row ? Number(row.answered) === 1 : false;

  if (!answered) {
    ctx.waitUntil(
      sendUfytMissedCallAlerts(env, { ...row, lead_id: leadId })
        .then(() => env.DB.prepare(`UPDATE calls SET alerted_at = datetime('now') WHERE call_sid = ?`).bind(callSid).run())
        .catch(error => console.error('Missed call alert error:', error.message))
    );
  }

  return new Response(JSON.stringify({ success: true, status, leadId, answered }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleCallRecording(request, env, params) {
  await env.DB.prepare(`
    UPDATE calls
    SET recording_sid = ?, recording_url = ?, recording_duration_seconds = ?, updated_at = datetime('now')
    WHERE call_sid = ?
  `).bind(
    params.RecordingSid || null,
    params.RecordingUrl || null,
    parseInt(params.RecordingDuration) || null,
    params.CallSid
  ).run();
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function describeCallOutcome(call) {
  if (Number(call.answered) === 1) return 'answered';
  if (call.dial_status === 'busy' || call.status === 'busy') return 'busy';
  if (call.dial_status === 'no-answer' || call.status === 'no-answer') return 'missed (no answer)';
  if (call.dial_status === 'failed' || call.status === 'failed') return 'failed';
  if (call.status === 'canceled') return 'caller hung up';
  return 'missed';
}

function buildMissedCallEmail(call) {
  const outcome = describeCallOutcome(call);
  const caller = call.caller || 'Number withheld';
  const location = [call.caller_city, call.caller_state].filter(Boolean).join(', ');
  return `
    <h2>Missed UFYT call</h2>
    <p><strong>Caller:</strong> <a href="tel:${escapeHtml(caller)}">${escapeHtml(caller)}</a>${call.caller_name ? ` (${escapeHtml(call.caller_name)})` : ''}</p>
    ${location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ''}
    <p><strong>Source:</strong> ${escapeHtml(call.source)} tracking number</p>
    <p><strong>Outcome:</strong> ${escapeHtml(outcome)}</p>
    <p><strong>Time:</strong> ${escapeHtml(call.started_at || '')} UTC</p>
    ${call.lead_id ? `<p><strong>Lead ID:</strong> ${escapeHtml(call.lead_id)}</p>` : ''}
    <p><a href="https://ufyt-leads-dash.pages.dev">Open the UFYT Lead Desk to call back</a></p>
  `;
}

function buildMissedCallSmsBody(call) {
  return `Missed UFYT call (${call.source}): ${call.caller || 'number withheld'}\nLead #${call.lead_id || '?'}: https://ufyt-leads-dash.pages.dev`;
}

async function sendUfytMissedCallAlerts(env, call) {
  const tasks = [];
  const emails = String(env.UFYT_NOTIFICATION_EMAILS || '').split(',').map(email => email.trim()).filter(Boolean);
  if (env.UFYT_RESEND_API_KEY && emails.length > 0) {
    tasks.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.UFYT_RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Unfuck Your Taxes <leads@unfuckyourtaxes.com>',
          to: emails,
          subject: `Missed UFYT call: ${call.caller || 'number withheld'} (${call.source})`,
          html: buildMissedCallEmail(call),
        }),
      }).then(response => {
        if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
      })
    );
  }

  const smsRecipients = getUfytSmsAlertRecipients(env.UFYT_SMS_NOTIFICATION_NUMBERS);
  const smsConfigured = env.UFYT_TWILIO_ACCOUNT_SID
    && env.UFYT_TWILIO_API_KEY_SID
    && env.UFYT_TWILIO_API_KEY_SECRET
    && env.UFYT_TWILIO_MESSAGING_SERVICE_SID
    && smsRecipients.length > 0;
  if (smsConfigured) {
    tasks.push(sendUfytSms({
      accountSid: env.UFYT_TWILIO_ACCOUNT_SID,
      apiKeySid: env.UFYT_TWILIO_API_KEY_SID,
      apiKeySecret: env.UFYT_TWILIO_API_KEY_SECRET,
      messagingServiceSid: env.UFYT_TWILIO_MESSAGING_SERVICE_SID,
      recipients: smsRecipients,
      body: buildMissedCallSmsBody(call),
    }));
  }

  if (tasks.length === 0) {
    console.warn('Missed call alert skipped: no alert channel configured');
    return;
  }
  await Promise.all(tasks);
}

async function handleCallRoute(request, env, ctx, path) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const config = getUfytCallConfig(env);
  if (!config) {
    return new Response(JSON.stringify({ success: false, error: 'Call tracking is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = await readTwilioParams(request);
  if (!(await verifyTwilioSignature(request, config.authToken, params))) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid Twilio signature' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!params.CallSid && path !== '/api/calls/whisper') {
    return new Response(JSON.stringify({ success: false, error: 'CallSid is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    switch (path) {
      case '/api/calls/voice':
        return await handleCallVoice(request, env, params, config);
      case '/api/calls/whisper':
        return handleCallWhisper(request);
      case '/api/calls/dial':
        return await handleCallDialResult(request, env, params);
      case '/api/calls/status':
        return await handleCallStatus(request, env, ctx, params, config);
      case '/api/calls/recording':
        return await handleCallRecording(request, env, params);
      default:
        return new Response('Not found', { status: 404 });
    }
  } catch (error) {
    console.error('Call webhook error:', error);
    // Keep the caller connected to something useful even if logging fails.
    if (path === '/api/calls/voice') {
      const source = config.trackingNumbers.get(String(params.To || '')) || 'unknown';
      return twimlResponse(buildVoiceTwiml({
        config,
        source,
        caller: params.From,
        trackingNumber: String(params.To || ''),
        baseUrl: new URL(request.url).origin,
      }));
    }
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleGetCalls(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 100, 500);
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const source = url.searchParams.get('source');
    const leadId = parseInt(url.searchParams.get('lead_id'));
    const missedOnly = url.searchParams.get('missed') === '1';

    let query = `
      SELECT c.id, c.call_sid, c.source, c.tracking_number, c.caller, c.caller_name, c.caller_city, c.caller_state,
             c.status, c.dial_status, c.answered, c.duration_seconds, c.recording_url, c.recording_duration_seconds,
             c.lead_id, c.lead_created, c.alerted_at, c.started_at, c.ended_at, l.name AS lead_name, l.status AS lead_status
      FROM calls c
      LEFT JOIN leads l ON l.id = c.lead_id
      WHERE 1=1`;
    const params = [];
    if (source) { query += ' AND c.source = ?'; params.push(source); }
    if (leadId) { query += ' AND c.lead_id = ?'; params.push(leadId); }
    if (missedOnly) { query += ' AND c.answered = 0'; }
    query += ' ORDER BY c.started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, calls: result.results, count: result.results.length }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Get calls error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), { status: 500, headers: corsHeaders });
  }
}

async function getCallStats(env) {
  try {
    const [total, today, missedToday, bySource] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS count FROM calls').first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM calls WHERE DATE(started_at) = DATE('now')").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM calls WHERE DATE(started_at) = DATE('now') AND answered = 0 AND ended_at IS NOT NULL").first(),
      env.DB.prepare('SELECT source, COUNT(*) AS count, SUM(answered) AS answered FROM calls GROUP BY source').all(),
    ]);
    return {
      total: total.count,
      today: today.count,
      missed_today: missedToday.count,
      by_source: bySource.results,
    };
  } catch (error) {
    // The calls table may not exist yet on an environment that has not run 0003.
    console.error('Call stats error:', error.message);
    return null;
  }
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

export {
  buildUfytSmsAlertBody,
  getUfytSmsAlertRecipients,
  sendUfytSmsLeadAlerts,
  computeTwilioSignature,
  parseTrackingNumberMap,
  buildVoiceTwiml,
  buildWhisperTwiml,
  getUfytCallConfig,
};
