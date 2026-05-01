const baseUrl = (process.env.PIGOU_OS_INTERNAL_URL || process.env.PIGOU_OS_BASE_URL || 'http://pigou-os:3888').replace(/\/+$/, '');
const password = process.env.PIGOU_LOGIN_PASSWORD;
const rebuildSecret = process.env.PIGOU_LLM_WIKI_REBUILD_SECRET || process.env.CRON_SECRET;
const scopeArg = process.argv.find(arg => arg.startsWith('--scope='))?.split('=')[1];
const scope = ['all', 'knowledge', 'ideas', 'projects'].includes(scopeArg || '') ? scopeArg : 'all';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { ok: false, message: text };
  }
  return { response, json };
}

async function login() {
  if (!password) throw new Error('PIGOU_LOGIN_PASSWORD is not configured.');
  const { response, json } = await request('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (!response.ok || !json?.ok) throw new Error(json?.message || `login failed: HTTP ${response.status}`);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('login did not return a session cookie.');
  return cookie;
}

async function main() {
  const headers = { 'content-type': 'application/json' };
  if (rebuildSecret) {
    headers['x-pigou-cron-secret'] = rebuildSecret;
  } else {
    headers.cookie = await login();
  }
  const { response, json } = await request('/api/llm-wiki/rebuild', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope })
  });
  if (!response.ok || !json?.ok) throw new Error(json?.message || `rebuild failed: HTTP ${response.status}`);
  const graph = json.graph;
  console.log(`[llm-wiki-rebuild] ${graph.nodes.length} node(s), ${graph.edges.length} edge(s), scope=${graph.scope}, generated=${graph.generatedAt}`);
  const notableConnections = Array.isArray(graph.analysis?.notableConnections) ? graph.analysis.notableConnections.slice(0, 3) : [];
  if (notableConnections.length) {
    console.log('[llm-wiki-rebuild] notable connections:');
    for (const connection of notableConnections) {
      console.log(`- ${connection.note || `${connection.from} -> ${connection.to}`} [${connection.type}/${connection.confidence}]: ${connection.reason}`);
    }
  } else {
    console.log('[llm-wiki-rebuild] no notable connections for today.');
  }
}

main().catch(error => {
  console.log(`[llm-wiki-rebuild] ${error.message}`);
  process.exitCode = 1;
});
