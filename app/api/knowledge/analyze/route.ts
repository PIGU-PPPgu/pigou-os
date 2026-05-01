import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { analyzeKnowledgeNote, detectPlatform, localDate } from '@/lib/brain-analysis';
import { getIdea, getIdeas, getKnowledgeNote, getProjects } from '@/lib/data';
import { updateKnowledgeNote } from '@/lib/knowledge-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const note = getKnowledgeNote(slug);
  if (!note) return NextResponse.json({ ok: false, message: 'Knowledge note not found.' }, { status: 404 });

  try {
    const analysis = await analyzeKnowledgeNote(note, getProjects(), getIdeas());
    const updated = await updateKnowledgeNote({
      ...note,
      analysis,
      platform: note.platform || detectPlatform({ sourceUrl: note.sourceUrl, rawText: `${note.title}\n${note.summary}`, tags: note.tags }),
      analyzedAt: localDate(),
      status: note.status === 'raw' ? 'processed' : note.status
    });
    return NextResponse.json({ ok: true, note: updated });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
