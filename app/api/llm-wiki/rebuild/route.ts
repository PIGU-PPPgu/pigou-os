import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import type { LlmWikiGraph } from '@/lib/data';
import { getIdeas, getKnowledge, getProjects, getTasks } from '@/lib/data';
import { buildLlmWikiGraph, writeLlmWikiGraph } from '@/lib/llm-wiki-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

const scopes = ['all', 'knowledge', 'ideas', 'projects'] as const;
type RebuildScope = LlmWikiGraph['scope'];

function hasCronSecret(request: Request) {
  const secret = process.env.PIGOU_LLM_WIKI_REBUILD_SECRET || process.env.CRON_SECRET || '';
  if (!secret) return false;
  const header = request.headers.get('x-pigou-cron-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return header === secret;
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request) && !hasCronSecret(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const scope = scopes.includes(body?.scope) ? body.scope as RebuildScope : 'all';

  return rebuild(scope);
}

export async function GET(request: Request) {
  if (!hasCronSecret(request)) {
    return NextResponse.json({ ok: false, message: 'Missing rebuild cron secret.' }, { status: 401 });
  }
  const rawScope = new URL(request.url).searchParams.get('scope');
  const scope = scopes.includes(rawScope as RebuildScope) ? rawScope as RebuildScope : 'all';
  return rebuild(scope);
}

async function rebuild(scope: RebuildScope) {
  try {
    const graph = await buildLlmWikiGraph({ projects: getProjects(), ideas: getIdeas(), knowledge: getKnowledge(), tasks: getTasks(), scope, withAi: true });
    await writeLlmWikiGraph(graph);
    return NextResponse.json({ ok: true, graph });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
