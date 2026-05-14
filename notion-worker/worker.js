// Cloudflare Worker — CORS-enabled Notion API proxy for english.html
//
// Setup:
//   1. Deploy this file as a Cloudflare Worker
//   2. Set env vars in the Worker dashboard → Settings → Variables:
//        ALLOWED_ORIGIN  = https://welsonchen0704.github.io
//        NOTION_TOKEN    = ntn_xxx... (your Notion integration secret)
//   3. Copy the *.workers.dev URL into english.html settings
//
// The Notion token never leaves Cloudflare — the browser only knows the
// Worker URL. Origin check rejects anyone hitting the Worker from
// elsewhere.

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return new Response('Forbidden: bad origin', { status: 403 });
    }
    if (!env.NOTION_TOKEN) {
      return jsonError('Worker not configured: NOTION_TOKEN missing', 500, origin, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');
    // Whitelist endpoints used by the app
    if (!/^(pages|databases\/[\w-]+\/query|databases\/[\w-]+|search)\/?$/.test(path)) {
      return jsonError(`Path not allowed: /${path}`, 403, origin, env);
    }

    const body = (request.method === 'GET' || request.method === 'HEAD')
      ? null
      : await request.text();

    let upstream;
    try {
      upstream = await fetch(`${NOTION_API}/${path}`, {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${env.NOTION_TOKEN}`,
          'Notion-Version': NOTION_VERSION,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (e) {
      return jsonError('Upstream fetch failed: ' + e.message, 502, origin, env);
    }

    const respBody = await upstream.text();
    return new Response(respBody, {
      status: upstream.status,
      headers: {
        ...corsHeaders(origin, env),
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};

function corsHeaders(origin, env) {
  const allow = (env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonError(message, status, origin, env) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}
