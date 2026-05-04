import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { analyzeIdea, localDate } from '@/lib/brain-analysis';
import { getIdea, getKnowledge, getProjects } from '@/lib/data';
import { updateIdea } from '@/lib/idea-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const idea = getIdea(slug);
  if (!idea) return NextResponse.json({ ok: false, message: 'Idea not found.' }, { status: 404 });

  try {
    const analysis = await analyzeIdea(idea, getKnowledge(), getProjects());
    const updated = await updateIdea({ ...idea, analysis: { ...analysis, suggestedProject: idea.projectSlug || analysis.suggestedProject }, relatedKnowledge: analysis.evidenceLinks, analyzedAt: localDate() });
    return NextResponse.json({ ok: true, idea: updated });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
