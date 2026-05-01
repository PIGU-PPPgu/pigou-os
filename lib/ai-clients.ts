type ChatMessage = { role: 'system' | 'user'; content: string };

function timeoutSignal(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function withV1(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export function getLlmConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: withV1(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  };
}

export function getEmbeddingConfig() {
  return {
    apiKey: process.env.OPENAI_EMBEDDING_API_KEY || process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: withV1(process.env.OPENAI_EMBEDDING_BASE_URL || process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
    model: process.env.OPENAI_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL || 'text-embedding-3-small'
  };
}

export async function createChatJson<T>({ messages, schema, schemaName }: { messages: ChatMessage[]; schema: unknown; schemaName: string }) {
  const config = getLlmConfig();
  if (!config.apiKey) return null;

  const request = timeoutSignal(envNumber('PIGOU_LLM_TIMEOUT_MS', 20000));
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: request.signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: true,
            schema
          }
        }
      })
    });

    if (!response.ok) throw new Error(`LLM request failed: HTTP ${response.status}`);
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return null;
    return JSON.parse(content) as T;
  } finally {
    request.clear();
  }
}

export async function createEmbedding(input: string) {
  const config = getEmbeddingConfig();
  if (!config.apiKey) return null;

  const request = timeoutSignal(envNumber('PIGOU_EMBEDDING_TIMEOUT_MS', 15000));
  try {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      signal: request.signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        input
      })
    });

    if (!response.ok) throw new Error(`Embedding request failed: HTTP ${response.status}`);
    const json = await response.json();
    const vector = json?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector.map(Number) : null;
  } finally {
    request.clear();
  }
}
