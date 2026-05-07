/**
 * Unfuck Leads - Cloudflare Worker
 * Handles form submissions and API endpoints for lead dashboard
 */

export default {
  async fetch(request, env) {
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
        return await handleFormSubmission(request, env, corsHeaders);
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
async function handleFormSubmission(request, env, corsHeaders) {
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
      formData.problem || null,
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
