// Cloudflare Worker — quote-tool (index.html) Claude API proxy
//
// index.html POSTs an Anthropic Messages API body to this Worker's root URL;
// the Worker forwards it to api.anthropic.com with the real key and returns
// Anthropic's response verbatim.
//
// Required env vars (Worker dashboard → Settings → Variables and Secrets):
//   ALLOWED_ORIGIN     = https://welsonchen0704.github.io
//   ANTHROPIC_API_KEY  = sk-ant-... (Secret)
//   APP_PASSCODE       = your chosen passcode (Secret) — requests must send it
//                        in the X-Passcode header, otherwise 401
//
// Errors use Anthropic's envelope ({type:"error", error:{...}}) so the page's
// existing error handling can display them.

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return jsonError('forbidden', 'Forbidden: bad origin', 403, origin, env);
    }
    // Passcode gate — the Worker URL is published in the public page source,
    // so the Origin check alone only stops other websites, not direct callers.
    if (env.APP_PASSCODE) {
      if ((request.headers.get('X-Passcode') || '') !== env.APP_PASSCODE) {
        return jsonError('unauthorized', 'Unauthorized: bad passcode', 401, origin, env);
      }
    }
    if (request.method !== 'POST') {
      return jsonError('invalid_request_error', 'Method not allowed', 405, origin, env);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return jsonError('api_error', 'ANTHROPIC_API_KEY not configured on Worker', 500, origin, env);
    }

    const body = await request.text();
    const upstream = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
    });
  },
};

function corsHeaders(origin, env) {
  const allow = (env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Passcode',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonError(type, message, status, origin, env) {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { ...corsHeaders(origin, env), 'Content-Type': 'application/json' },
  });
}
