import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getIdea } from '@/lib/data';
import { updateIdea } from '@/lib/idea-store';
import { createProject, createProjectFromIdea } from '@/lib/project-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

function splitList(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input.split(/[\n,，|]/).map(item => item.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const ideaSlug = typeof body?.ideaSlug === 'string' ? body.ideaSlug.trim() : '';

  try {
    if (ideaSlug) {
      const idea = getIdea(ideaSlug);
      if (!idea) return NextResponse.json({ ok: false, message: 'Idea not found.' }, { status: 404 });
      const project = await createProjectFromIdea(idea);
      await updateIdea({ ...idea, status: 'building', analysis: idea.analysis ? { ...idea.analysis, suggestedProject: project.slug } : idea.analysis });
      return NextResponse.json({ ok: true, project });
    }

    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const summary = typeof body?.summary === 'string' ? body.summary.trim() : '';
    if (!title || !summary) return NextResponse.json({ ok: false, message: 'Project title and summary are required.' }, { status: 400 });
    const project = await createProject({
      title,
      summary,
      status: body?.status === 'building' || body?.status === 'paused' || body?.status === 'shipped' || body?.status === 'archived' ? body.status : 'idea',
      priority: body?.priority === 'high' || body?.priority === 'low' ? body.priority : 'medium',
      explanation: typeof body?.explanation === 'string' ? body.explanation : undefined,
      domain: typeof body?.domain === 'string' ? body.domain : undefined,
      source: typeof body?.source === 'string' ? body.source : undefined,
      visibility: body?.visibility === 'public' ? 'public' : 'private',
      progress: Number.isFinite(body?.progress) ? Number(body.progress) : 10,
      goals: splitList(body?.goals).length ? splitList(body.goals) : ['Define the first measurable outcome.'],
      nextActions: splitList(body?.nextActions).length ? splitList(body.nextActions) : ['Choose the next smallest action.']
    });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}
