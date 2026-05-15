// Simple test worker to verify DB binding
export default {
  async fetch(request, env, ctx) {
    try {
      console.log('Worker started');
      console.log('env.DB exists:', !!env.DB);
      console.log('env.DB type:', typeof env.DB);

      if (!env.DB) {
        return new Response(JSON.stringify({
          error: 'DB binding not found',
          envKeys: Object.keys(env)
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Try a simple query
      const result = await env.DB.prepare('SELECT 1 as test').first();
      console.log('Query result:', result);

      return new Response(JSON.stringify({
        success: true,
        message: 'DB binding works!',
        testQuery: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack,
        name: error.name
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
