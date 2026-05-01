import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getProject, getProjectWikiSnapshot } from '@/lib/data';

export const runtime = 'nodejs';

function baseUrl() {
  return (process.env.DEEPWIKI_OPEN_BASE_URL || 'http://localhost:8001').replace(/\/$/, '');
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const filePath = typeof body?.filePath === 'string' && body.filePath.trim() ? body.filePath.trim() : undefined;
  if (!slug || !question) {
    return NextResponse.json({ ok: false, message: '项目和问题是必填项。' }, { status: 400 });
  }

  const project = getProject(slug);
  const snapshot = getProjectWikiSnapshot(slug);
  const repo = snapshot?.repo;
  if (!project || !repo) {
    return NextResponse.json({ ok: false, message: '这个项目还没有 DeepWiki repo snapshot，请先运行 pnpm sync:wiki。' }, { status: 404 });
  }

  const payload: Record<string, unknown> = {
    repo_url: repo.url,
    type: 'github',
    language: 'zh',
    provider: process.env.DEEPWIKI_PROVIDER || 'openai',
    model: process.env.DEEPWIKI_MODEL || process.env.OPENAI_MODEL || undefined,
    messages: [{ role: 'user', content: question }]
  };

  if (filePath) payload.filePath = filePath;
  if (repo.private && process.env.DEEPWIKI_REPO_TOKEN) payload.token = process.env.DEEPWIKI_REPO_TOKEN;

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/chat/completions/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });
  } catch {
    return NextResponse.json({
      ok: false,
      message: `无法连接 deepwiki-open 服务。请先启动 ${baseUrl()}。`
    }, { status: 502 });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return NextResponse.json({
      ok: false,
      message: `deepwiki-open 返回 HTTP ${response.status}`,
      detail: detail.slice(0, 1200)
    }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      'content-type': response.headers.get('content-type') || 'text/plain; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}
