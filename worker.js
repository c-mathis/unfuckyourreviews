// Cloudflare Worker for Unfuck Your Reviews Lead Capture
// Simple version matching TPN's working setup

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

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

      // Determine source
      let source = 'reviews';
      if (referer.includes('unfuckyourweb')) source = 'web';
      else if (referer.includes('unfuckyourads')) source = 'ads';

      console.log('About to insert into DB, binding:', typeof env.DB);

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
        data.name,
        data.email,
        data.phone || null,
        data.business || null,
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

      // Send email notification if Resend is configured
      if (env.RESEND_API_KEY) {
        ctx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Unfuck Your Reviews <leads@taxpeacenow.com>',
              to: ['cameron@axesagency.com'],
              subject: `New Review Lead: ${data.name}`,
              html: `
                <h2>New Review Management Lead</h2>
                <p><strong>Name:</strong> ${data.name}</p>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
                <p><strong>Business:</strong> ${data.business || 'Not provided'}</p>
                <p><strong>Situation:</strong> ${data.situation || 'Not provided'}</p>
                <p><strong>Source:</strong> ${source}</p>
                <p><strong>Lead ID:</strong> ${result.meta.last_row_id}</p>
              `,
            }),
          }).catch(err => console.error('Email send error:', err))
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
