const baseUrl = (process.env.PIGOU_OS_INTERNAL_URL || process.env.PIGOU_OS_BASE_URL || 'http://pigou-os:3888').replace(/\/+$/, '');
const password = process.env.PIGOU_LOGIN_PASSWORD;

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
  const cookie = await login();
  const { response, json } = await request('/api/projects/status-suggestions', {
    headers: { cookie }
  });
  if (!response.ok || !json?.ok) throw new Error(json?.message || `suggestions failed: HTTP ${response.status}`);

  const suggestions = Array.isArray(json.suggestions) ? json.suggestions : [];
  console.log(`[progress-evaluator] ${suggestions.length} changed project(s).`);
  for (const suggestion of suggestions) {
    const result = await request('/api/projects/status-suggestions', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ slug: suggestion.slug, suggestion })
    });
    if (!result.response.ok || !result.json?.ok) {
      console.log(`[progress-evaluator] failed ${suggestion.slug}: ${result.json?.message || result.response.status}`);
      continue;
    }
    console.log(`[progress-evaluator] updated ${suggestion.slug}: ${suggestion.currentProgress} -> ${suggestion.suggestedProgress}`);
  }
}

main().catch(error => {
  console.log(`[progress-evaluator] ${error.message}`);
  process.exitCode = 1;
});
