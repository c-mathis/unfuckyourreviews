/**
 * Unfuck Leads - Cloudflare Worker
 * Handles form submissions and API endpoints for lead dashboard
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    try {
      // Form submission endpoint
      if (path === '/submit' && request.method === 'POST') {
        return await handleFormSubmission(request, env, ctx, corsHeaders);
      }

      // Dashboard API - Get all leads
      if (path === '/api/leads' && request.method === 'GET') {
        return await getLeads(request, env, corsHeaders);
      }

      // Dashboard API - Get stats
      if (path === '/api/stats' && request.method === 'GET') {
        return await getStats(request, env, corsHeaders);
      }

      // Dashboard API - Update lead status
      if (path === '/api/leads/update' && request.method === 'POST') {
        return await updateLead(request, env, corsHeaders);
      }

      // 404
      return new Response('Not Found', { status: 404 });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Handle form submission from landing pages
 */
async function handleFormSubmission(request, env, ctx, corsHeaders) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let formData = {};

    // Parse form data
    if (contentType.includes('application/json')) {
      formData = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        formData[key] = value;
      }
    } else {
      return new Response('Unsupported Content-Type', { status: 415 });
    }

    // Validate required fields
    if (!formData.name || !formData.email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine source from referer or form data
    const referer = request.headers.get('referer') || '';
    let source = formData.source || 'unknown';

    if (!formData.source) {
      if (referer.includes('unfuckyourreviews')) source = 'reviews';
      else if (referer.includes('unfuckyourweb')) source = 'web';
      else if (referer.includes('unfuckyourads')) source = 'ads';
      else if (referer.includes('unfuckyourcopy')) source = 'copy';
    }

    // Get client IP and user agent
    const ipAddress = request.headers.get('cf-connecting-ip') ||
                     request.headers.get('x-forwarded-for') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Insert into D1 database
    const result = await env.DB.prepare(`
      INSERT INTO leads (
        source, name, email, phone, website, problem,
        selected_issues, issues_count,
        utm_source, utm_medium, utm_campaign, utm_content,
        referrer, landing_page,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      source,
      formData.name,
      formData.email,
      formData.phone || null,
      formData.website || null,
      formData.gbp_url || null,  // Store GBP URL in 'problem' field temporarily
      formData.selected_issues || null,
      parseInt(formData.issues_count) || 0,
      formData.utm_source || null,
      formData.utm_medium || null,
      formData.utm_campaign || null,
      formData.utm_content || null,
      formData.referrer || null,
      formData.landing_page || null,
      ipAddress,
      userAgent
    ).run();

    // Log activity
    await env.DB.prepare(`
      INSERT INTO activity_log (lead_id, activity_type, description)
      VALUES (?, ?, ?)
    `).bind(
      result.meta.last_row_id,
      'lead_created',
      `New ${source} lead submitted`
    ).run();

    // Send Meta Conversion API event (server-side tracking)
    // Use ctx.waitUntil so it doesn't delay the response
    if (env.META_PIXEL_ID && env.META_ACCESS_TOKEN) {
      ctx.waitUntil(
        sendMetaConversionEvent(env, formData, ipAddress, userAgent, referer)
      );
    }

    // Send emails via Resend
    if (env.RESEND_API_KEY) {
      ctx.waitUntil(
        Promise.all([
          // Send notification to you
          sendAdminNotification(env, formData, result.meta.last_row_id),
          // Send confirmation to lead
          sendLeadConfirmation(env, formData)
        ])
      );
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Lead submitted successfully',
      leadId: result.meta.last_row_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Form submission error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit lead' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get all leads with filtering
 */
async function getLeads(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    let query = 'SELECT * FROM leads WHERE 1=1';
    const bindings = [];

    if (source) {
      query += ' AND source = ?';
      bindings.push(source);
    }

    if (status) {
      query += ' AND status = ?';
      bindings.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const { results } = await env.DB.prepare(query).bind(...bindings).all();

    return new Response(JSON.stringify({
      success: true,
      leads: results,
      count: results.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get leads error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch leads' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get dashboard stats
 */
async function getStats(request, env, corsHeaders) {
  try {
    // Total leads
    const { results: totalResults } = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM leads
    `).all();

    // Leads by source
    const { results: bySource } = await env.DB.prepare(`
      SELECT source, COUNT(*) as count FROM leads GROUP BY source
    `).all();

    // Leads by status
    const { results: byStatus } = await env.DB.prepare(`
      SELECT status, COUNT(*) as count FROM leads GROUP BY status
    `).all();

    // Leads today
    const { results: todayResults } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE DATE(created_at) = DATE('now')
    `).all();

    // Leads this week
    const { results: weekResults } = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM leads
      WHERE created_at >= datetime('now', '-7 days')
    `).all();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: totalResults[0]?.total || 0,
        today: todayResults[0]?.count || 0,
        thisWeek: weekResults[0]?.count || 0,
        bySource: bySource,
        byStatus: byStatus
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update lead status and notes
 */
async function updateLead(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { id, status, priority, notes, nextAction, nextActionDate } = data;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Lead ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updates = [];
    const bindings = [];

    if (status) {
      updates.push('status = ?');
      bindings.push(status);
    }
    if (priority) {
      updates.push('priority = ?');
      bindings.push(priority);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      bindings.push(notes);
    }
    if (nextAction !== undefined) {
      updates.push('next_action = ?');
      bindings.push(nextAction);
    }
    if (nextActionDate !== undefined) {
      updates.push('next_action_date = ?');
      bindings.push(nextActionDate);
    }

    updates.push('updated_at = datetime("now")');
    bindings.push(id);

    await env.DB.prepare(`
      UPDATE leads SET ${updates.join(', ')} WHERE id = ?
    `).bind(...bindings).run();

    // Log activity
    if (status) {
      await env.DB.prepare(`
        INSERT INTO activity_log (lead_id, activity_type, description)
        VALUES (?, ?, ?)
      `).bind(id, 'status_changed', `Status updated to ${status}`).run();
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Lead updated successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update lead error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update lead' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Send conversion event to Meta Conversion API (CAPI)
 * Server-side tracking for better iOS 14+ attribution
 */
async function sendMetaConversionEvent(env, formData, ipAddress, userAgent, sourceUrl) {
  try {
    const pixelId = env.META_PIXEL_ID;
    const accessToken = env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn('Meta Pixel ID or Access Token not configured');
      return;
    }

    // Hash email for privacy
    const emailHash = formData.email ?
      await hashSHA256(formData.email.toLowerCase().trim()) : null;

    // Parse name into first/last for advanced matching
    const name = formData.name || '';
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Hash names
    const firstNameHash = firstName ?
      await hashSHA256(firstName.toLowerCase().trim()) : null;
    const lastNameHash = lastName ?
      await hashSHA256(lastName.toLowerCase().trim()) : null;

    // Prepare event data for Meta CAPI
    const eventData = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: sourceUrl || 'https://unfuckyourreviews.com',
        action_source: 'website',
        user_data: {
          em: emailHash,
          fn: firstNameHash,
          ln: lastNameHash,
          client_ip_address: ipAddress,
          client_user_agent: userAgent,
          external_id: formData.business || formData.email  // Business name as external ID
        },
        custom_data: {
          content_name: 'Review Management Service',
          content_category: 'Service Inquiry',
          value: 399.00,
          currency: 'USD'
        }
      }]
    };

    // Send to Meta CAPI
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI error:', result);
    } else {
      console.log('Meta CAPI event sent successfully:', result);
    }

  } catch (error) {
    console.error('Meta CAPI send error:', error);
    // Don't throw - we don't want to break form submission if tracking fails
  }
}

/**
 * Hash string with SHA-256 for Meta CAPI
 */
async function hashSHA256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send admin notification via Resend
 */
async function sendAdminNotification(env, formData, leadId) {
  try {
    const resendApiKey = env.RESEND_API_KEY;
    const notificationEmail = env.NOTIFICATION_EMAIL || 'cameron@axesagency.com';

    if (!resendApiKey) {
      console.warn('Resend API key not configured');
      return;
    }

    // Build email content
    const emailBody = `
New Lead Submitted - Unfuck Your Reviews

Lead ID: ${leadId}
Source: ${formData.source || 'reviews'}

CONTACT INFO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${formData.name}
Email: ${formData.email}

RESEARCH LINKS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website: ${formData.website || 'Not provided'}
Google Business Profile: ${formData.gbp_url || 'Not provided'}

REVIEW SITUATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formData.situation || 'Not specified'}

ISSUES SELECTED (${formData.issues_count || 0}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formData.selected_issues || 'None selected'}

TRACKING INFO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UTM Source: ${formData.utm_source || 'N/A'}
UTM Medium: ${formData.utm_medium || 'N/A'}
UTM Campaign: ${formData.utm_campaign || 'N/A'}
Landing Page: ${formData.landing_page || 'N/A'}
Referrer: ${formData.referrer || 'Direct'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View in dashboard: https://dashboard.unfuckyourweb.com
`.trim();

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Unfuck Your Reviews <leads@unfuckyourreviews.com>',
        to: [notificationEmail],
        subject: `🔔 New Lead: ${formData.name} - ${formData.situation || 'Review Issue'}`,
        text: emailBody
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend error (admin notification):', error);
    } else {
      console.log('Admin notification sent successfully');
    }

  } catch (error) {
    console.error('Admin notification error:', error);
    // Don't throw - we don't want to break form submission if email fails
  }
}

/**
 * Send confirmation email to lead via Resend
 */
async function sendLeadConfirmation(env, formData) {
  try {
    const resendApiKey = env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.warn('Resend API key not configured');
      return;
    }

    // Build confirmation email
    const emailBody = `
Hey ${formData.name.split(' ')[0]},

Got your submission.

I'm pulling up your Google reviews right now and I'll send you a personalized video breakdown within 24 hours showing exactly what's fixable.

If you want to hop on a quick call before that, just reply to this email.

— Cameron
Unfuck Your Reviews
unfuckyourreviews.com
`.trim();

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Cameron from Unfuck Your Reviews <cameron@unfuckyourreviews.com>',
        to: [formData.email],
        reply_to: 'cameron@axesagency.com',
        subject: 'Got it - looking at your reviews now',
        text: emailBody
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend error (lead confirmation):', error);
    } else {
      console.log('Lead confirmation sent successfully');
    }

  } catch (error) {
    console.error('Lead confirmation error:', error);
    // Don't throw - we don't want to break form submission if email fails
  }
}
