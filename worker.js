// Cloudflare Worker for Unfuck Your Reviews Lead Capture
// Handles form submissions + dashboard API

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Route requests
    if (path === '/api/leads' && request.method === 'GET') {
      return handleGetLeads(request, env);
    }

    if (path === '/api/stats' && request.method === 'GET') {
      return handleGetStats(request, env);
    }

    if (path === '/api/leads/update' && request.method === 'POST') {
      return handleUpdateLead(request, env);
    }

    // Default: Form submission (POST to / or /submit)
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      console.log('Received data:', data);

      // Get client IP and user agent
      const clientIp = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
      const userAgent = request.headers.get('User-Agent') || '';
      const referer = request.headers.get('referer') || '';

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
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );

    } catch (error) {
      console.error('Worker error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Internal server error',
          errorType: error.name,
          errorStack: error.stack
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  }
};

// ============================================
// API ENDPOINT HANDLERS
// ============================================

async function handleGetLeads(request, env) {
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Get leads error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

async function handleGetStats(request, env) {
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Get stats error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

async function handleUpdateLead(request, env) {
  try {
    const data = await request.json();
    const { id, status, notes } = data;

    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Lead ID is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
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
        JSON.stringify({
          success: false,
          error: 'No fields to update',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    params.push(id);
    const query = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = ?`;

    await env.DB.prepare(query).bind(...params).run();

    // Log activity
    if (status) {
      await env.DB.prepare(`
        INSERT INTO activity_log (lead_id, action, details)
        VALUES (?, 'status_change', ?)
      `).bind(id, `Status changed to: ${status}`).run();
    }

    if (notes !== undefined) {
      await env.DB.prepare(`
        INSERT INTO activity_log (lead_id, action, details)
        VALUES (?, 'note_added', ?)
      `).bind(id, notes).run();
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Lead updated successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Update lead error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
