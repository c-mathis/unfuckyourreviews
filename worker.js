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

    // Default: Form submission (POST to / or /submit) — PUBLIC
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      console.log('Received data:', data);

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

      // Determine source based on referer
      let source = 'unknown';
      if (referer.includes('unfuckyourweb')) source = 'web';
      else if (referer.includes('unfuckyourreviews')) source = 'reviews';
      else if (referer.includes('unfuckyourads')) source = 'ads';
      else if (referer.includes('unfuckyourtaxes')) source = 'taxes';

      console.log('About to insert into DB, binding:', typeof env.DB);

      // Insert into D1 database
      const result = await env.DB.prepare(`
        INSERT INTO leads (
          source, name, email, website, gbp_url, problem,
          selected_issues, issues_count,
          utm_source, utm_medium, utm_campaign, utm_content,
          referrer, landing_page,
          ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        source,
        data.name,
        data.email,
        data.website || null,
        data.gbp_url || null,
        data.situation || null,
        data.selected_issues || null,
        parseInt(data.issues_count) || 0,
        data.utm_source || null,
        data.utm_medium || null,
        data.utm_campaign || null,
        data.utm_content || null,
        data.referrer || referer || null,
        data.landing_page || null,
        clientIp,
        userAgent
      ).run();

      console.log('Lead saved:', result.meta.last_row_id);

      // Send Meta Conversions API event
      const capiSources = ['web', 'reviews', 'ads'];
      if (env.META_ACCESS_TOKEN && capiSources.includes(source)) {
        const contentNames = {
          web: 'Website Audit Request',
          reviews: 'Review Management Service',
          ads: 'Ads Audit Request',
        };
        ctx.waitUntil(sendMetaConversionEvent(env, {
          eventName: 'Lead',
          eventTime: Math.floor(Date.now() / 1000),
          eventSourceUrl: data.landing_page || referer,
          userData: {
            email: data.email,
            clientIpAddress: clientIp,
            clientUserAgent: userAgent,
          },
          customData: {
            content_name: contentNames[source] || 'Lead Form Submission',
            content_category: 'Lead Generation',
            value: 0,
            currency: 'USD',
          },
        }));
      }

      // Send email notifications if Resend is configured
      if (env.RESEND_API_KEY) {
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
            replyTo: 'cameron@unfuckyourtaxes.com',
            subject: 'New Tax Lead',
            type: 'Tax Relief',
            userSubject: 'So your taxes are fucked?',
            userMessage: `Hey ${data.name.split(' ')[0]},

Got your submission.

I'm reviewing your tax situation right now. I've got a plan coming your way in about 24 hours to get you back on track.

I'll hit you up shortly.

To unfuckery and beyond,
— Cameron`,
          },
        };

        const brand = brandConfig[source] || brandConfig.reviews;

        // Internal notification to you
        ctx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `${brand.name} <${brand.fromEmail}>`,
              to: ['cameron@axesagency.com'],
              subject: `${brand.subject}: ${data.name}`,
              html: `
                <h2>New ${brand.type} Lead</h2>
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Website:</strong> ${data.website || 'Not provided'}</p>
                <p><strong>Problem:</strong> ${data.problem || data.situation || 'Not provided'}</p>
                <p><strong>Selected Issues (${data.issues_count || 0}):</strong> ${data.selected_issues || 'None'}</p>
                <p><strong>Source:</strong> ${source}</p>
                <p><strong>Lead ID:</strong> ${result.meta.last_row_id}</p>
              `,
            }),
          }).catch(err => console.error('Internal email error:', err))
        );

        // Confirmation email to user
        ctx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `Cameron from ${brand.name} <${brand.replyTo}>`,
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

async function sendMetaConversionEvent(env, eventData) {
  const PIXEL_ID = '1494351685495599'; // Unfuck Your Web pixel
  const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;

  // Hash email for privacy
  const emailHash = await hashSHA256(eventData.userData.email);

  const payload = {
    data: [{
      event_name: eventData.eventName,
      event_time: eventData.eventTime,
      event_source_url: eventData.eventSourceUrl,
      action_source: 'website',
      user_data: {
        em: [emailHash], // Hashed email
        client_ip_address: eventData.userData.clientIpAddress,
        client_user_agent: eventData.userData.clientUserAgent,
      },
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
        access_token: env.META_ACCESS_TOKEN,
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
