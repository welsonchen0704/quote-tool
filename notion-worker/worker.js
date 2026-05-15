// Cloudflare Worker — Unified API proxy for english.html
//
// Routes:
//   POST /claude/messages         → api.anthropic.com/v1/messages
//   POST /openai/audio/speech     → api.openai.com/v1/audio/speech
//   POST /notion/pages            → api.notion.com/v1/pages (database_id injected)
//   POST /notion/databases/.../query, /search → Notion query endpoints
//
// All secrets live in Cloudflare env vars — the browser never sees them.
// Required env vars in the Worker dashboard → Settings → Variables:
//   ALLOWED_ORIGIN      = https://welsonchen0704.github.io
//   ANTHROPIC_API_KEY   = sk-ant-... (Secret)
//   OPENAI_API_KEY      = sk-... (Secret)
//   NOTION_TOKEN        = ntn_... (Secret)
//   NOTION_DATABASE_ID  = your database id (Text)

const ANTHROPIC_API = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const OPENAI_API = 'https://api.openai.com/v1';
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return new Response('Forbidden: bad origin', { status: 403 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '');

    try {
      if (path.startsWith('claude/')) {
        return await proxyAnthropic(request, env, path.slice('claude/'.length), origin);
      }
      if (path.startsWith('openai/')) {
        return await proxyOpenAI(request, env, path.slice('openai/'.length), origin);
      }
      if (path.startsWith('notion/')) {
        return await proxyNotion(request, env, path.slice('notion/'.length), origin);
      }
      return jsonError(`Unknown path: /${path}`, 404, origin, env);
    } catch (e) {
      return jsonError('Worker error: ' + (e && e.message ? e.message : String(e)), 500, origin, env);
    }
  },
};

async function proxyAnthropic(request, env, subPath, origin) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonError('ANTHROPIC_API_KEY not configured on Worker', 500, origin, env);
  }
  if (!/^messages(\/count_tokens)?$/.test(subPath)) {
    return jsonError(`Path not allowed: /claude/${subPath}`, 403, origin, env);
  }
  const body = await request.text();
  const upstream = await fetch(`${ANTHROPIC_API}/${subPath}`, {
    method: request.method,
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body,
  });
  return passThrough(upstream, origin, env);
}

async function proxyOpenAI(request, env, subPath, origin) {
  if (!env.OPENAI_API_KEY) {
    return jsonError('OPENAI_API_KEY not configured on Worker', 500, origin, env);
  }
  if (!/^audio\/speech$/.test(subPath)) {
    return jsonError(`Path not allowed: /openai/${subPath}`, 403, origin, env);
  }
  const body = await request.text();
  const upstream = await fetch(`${OPENAI_API}/${subPath}`, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  return passThrough(upstream, origin, env, { keepContentType: true });
}

async function proxyNotion(request, env, subPath, origin) {
  if (!env.NOTION_TOKEN) {
    return jsonError('NOTION_TOKEN not configured on Worker', 500, origin, env);
  }
  if (!/^(pages|databases\/[\w-]+\/query|databases\/[\w-]+|search)\/?$/.test(subPath)) {
    return jsonError(`Path not allowed: /notion/${subPath}`, 403, origin, env);
  }

  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
    // For create-page, inject database_id from env var (server-side configured)
    if (subPath === 'pages' && env.NOTION_DATABASE_ID) {
      try {
        const json = JSON.parse(body);
        if (!json.parent || (!json.parent.database_id && !json.parent.page_id)) {
          json.parent = { database_id: env.NOTION_DATABASE_ID };
          body = JSON.stringify(json);
        }
      } catch (e) {
        // body not JSON — let Notion return the error
      }
    }
  }

  const upstream = await fetch(`${NOTION_API}/${subPath}`, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body,
  });
  return passThrough(upstream, origin, env);
}

function passThrough(upstream, origin, env, opts = {}) {
  const headers = { ...corsHeaders(origin, env) };
  if (opts.keepContentType) {
    headers['Content-Type'] = upstream.headers.get('Content-Type') || 'application/octet-stream';
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  headers['Content-Type'] = 'application/json';
  return upstream.text().then(body =>
    new Response(body, { status: upstream.status, headers })
  );
}

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
