import { NextResponse } from 'next/server';
import { createKnowledgeNote, updateKnowledgeNote } from '@/lib/knowledge-store';
import { isAuthenticatedRequest } from '@/lib/auth';
import { StorageConfigurationError } from '@/lib/storage-guard';
import { getIdeas, getKnowledgeNote, getProjects } from '@/lib/data';
import type { KnowledgeNote } from '@/lib/data';
import { analyzeKnowledgeNote, detectPlatform, localDate } from '@/lib/brain-analysis';

const noteTypes = ['source', 'insight', 'decision', 'pattern', 'question', 'asset'] as const;
const confidenceLevels = ['low', 'medium', 'high'] as const;

function splitList(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input
    .split(/[\n,，|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== 'string' || typeof body.summary !== 'string') {
    return NextResponse.json({ ok: false, message: '标题和摘要是必填项。' }, { status: 400 });
  }

  const title = body.title.trim();
  const summary = body.summary.trim();
  if (!title || !summary) {
    return NextResponse.json({ ok: false, message: '标题和摘要不能为空。' }, { status: 400 });
  }

  const type = noteTypes.includes(body.type) ? body.type : 'insight';
  const confidence = confidenceLevels.includes(body.confidence) ? body.confidence : 'medium';
  let note: KnowledgeNote;
  try {
    note = await createKnowledgeNote({
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      title,
      type,
      status: body.status === 'linked' || body.status === 'processed' ? body.status : 'raw',
      summary,
      keyPoints: splitList(body.keyPoints),
      tags: splitList(body.tags).length ? splitList(body.tags) : ['inbox'],
      relatedProjects: splitList(body.relatedProjects),
      sourceUrl: typeof body.sourceUrl === 'string' && body.sourceUrl.trim() ? body.sourceUrl.trim() : undefined,
      platform: detectPlatform({ sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined, rawText: `${title}\n${summary}`, tags: splitList(body.tags) }),
      confidence,
      next: typeof body.next === 'string' && body.next.trim() ? body.next.trim() : '把这条笔记关联到一个项目、想法或决策。',
      rawExtract: typeof body.rawExtract === 'string' && body.rawExtract.trim() ? body.rawExtract.trim().slice(0, 1800) : summary.slice(0, 1800)
    });
    const analysis = await analyzeKnowledgeNote(note, getProjects(), getIdeas()).catch(() => undefined);
    if (analysis) note = await updateKnowledgeNote({ ...note, analysis, analyzedAt: localDate() });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, note });
}

export async function PATCH(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const note = getKnowledgeNote(slug);
  if (!note) return NextResponse.json({ ok: false, message: 'Knowledge note not found.' }, { status: 404 });

  try {
    const updated = await updateKnowledgeNote({
      ...note,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : note.title,
      type: noteTypes.includes(body?.type) ? body.type : note.type,
      status: body?.status === 'raw' || body?.status === 'processed' || body?.status === 'linked' ? body.status : note.status,
      summary: typeof body?.summary === 'string' && body.summary.trim() ? body.summary.trim() : note.summary,
      keyPoints: splitList(body?.keyPoints).length ? splitList(body.keyPoints) : note.keyPoints,
      tags: splitList(body?.tags).length ? splitList(body.tags) : note.tags,
      relatedProjects: Array.isArray(body?.relatedProjects) || typeof body?.relatedProjects === 'string' ? splitList(body.relatedProjects) : note.relatedProjects,
      sourceUrl: typeof body?.sourceUrl === 'string' ? body.sourceUrl.trim() || undefined : note.sourceUrl,
      confidence: confidenceLevels.includes(body?.confidence) ? body.confidence : note.confidence,
      next: typeof body?.next === 'string' ? body.next.trim() || undefined : note.next
    });
    return NextResponse.json({ ok: true, note: updated });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
