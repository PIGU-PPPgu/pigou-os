import { NextResponse } from 'next/server';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';
import { embedKnowledgeNote } from '@/lib/embedding-store';
import { getIdeas, getProjects } from '@/lib/data';
import type { KnowledgeNote } from '@/lib/data';
import { analyzeKnowledgeNote, detectPlatform, localDate } from '@/lib/brain-analysis';
import { createKnowledgeNote, updateKnowledgeNote, writeKnowledgeNote } from '@/lib/knowledge-store';
import { isAuthenticatedRequest } from '@/lib/auth';
import { StorageConfigurationError } from '@/lib/storage-guard';

const noteTypes = ['source', 'insight', 'decision', 'pattern', 'question', 'asset'] as const;
const confidenceLevels = ['low', 'medium', 'high'] as const;

type ParsedInput = {
  title: string;
  type: KnowledgeNote['type'];
  summary: string;
  keyPoints: string[];
  tags: string[];
  relatedProjects: string[];
  sourceUrl?: string;
  confidence: KnowledgeNote['confidence'];
  next: string;
};

function extractFirstUrl(input: string) {
  return input.match(/https?:\/\/[^\s"'<>]+/)?.[0];
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickMeta(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return html.match(pattern)?.[1]?.trim();
}

async function fetchLinkContext(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'PigouOS/0.1 knowledge-ingest'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`链接读取失败：HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    return { title: url, description: contentType || '非网页资料', text: `${url}\n${contentType}` };
  }

  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || url;
  const description = pickMeta(html, 'description') || pickMeta(html, 'og:description') || '';
  const text = stripHtml(html).slice(0, 8000);
  return { title, description, text };
}

function normalizeParsed(input: Partial<ParsedInput>, fallback: ParsedInput): ParsedInput {
  const type = noteTypes.includes(input.type as KnowledgeNote['type']) ? input.type as KnowledgeNote['type'] : fallback.type;
  const confidence = confidenceLevels.includes(input.confidence as KnowledgeNote['confidence']) ? input.confidence as KnowledgeNote['confidence'] : fallback.confidence;
  return {
    title: input.title?.trim() || fallback.title,
    type,
    summary: input.summary?.trim() || fallback.summary,
    keyPoints: Array.isArray(input.keyPoints) && input.keyPoints.length ? input.keyPoints.map(String).filter(Boolean).slice(0, 6) : fallback.keyPoints,
    tags: Array.isArray(input.tags) && input.tags.length ? input.tags.map(String).filter(Boolean).slice(0, 8) : fallback.tags,
    relatedProjects: Array.isArray(input.relatedProjects) ? input.relatedProjects.map(String).filter(Boolean).slice(0, 6) : fallback.relatedProjects,
    sourceUrl: input.sourceUrl || fallback.sourceUrl,
    confidence,
    next: input.next?.trim() || fallback.next
  };
}

function fallbackParse(rawInput: string, url: string | undefined, context?: Awaited<ReturnType<typeof fetchLinkContext>>): ParsedInput {
  const title = context?.title || rawInput.slice(0, 72);
  const summary = context?.description || context?.text?.slice(0, 220) || rawInput.slice(0, 220);
  const keyPoints = [
    context?.description,
    url ? `来源链接：${url}` : undefined,
    rawInput.length > 120 ? rawInput.slice(0, 180) : undefined
  ].filter(Boolean) as string[];

  return {
    title,
    type: url ? 'source' : 'insight',
    summary,
    keyPoints,
    tags: ['inbox'],
    relatedProjects: [],
    sourceUrl: url,
    confidence: 'medium',
    next: '判断这条资料应该关联到哪个项目、想法或决策。'
  };
}

async function aiParse(rawInput: string, fallback: ParsedInput, context?: Awaited<ReturnType<typeof fetchLinkContext>>) {
  if (!getLlmConfig().apiKey) return fallback;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'type', 'summary', 'keyPoints', 'tags', 'relatedProjects', 'sourceUrl', 'confidence', 'next'],
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: noteTypes },
      summary: { type: 'string' },
      keyPoints: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
      relatedProjects: { type: 'array', items: { type: 'string' } },
      sourceUrl: { type: ['string', 'null'] },
      confidence: { type: 'string', enum: confidenceLevels },
      next: { type: 'string' }
    }
  };

  const parsed = await createChatJson<Partial<ParsedInput>>({
    schemaName: 'pigou_knowledge_note',
    schema,
    messages: [
      {
        role: 'system',
        content: '你是 Pigou OS 的知识解析器。把用户甩来的链接或文本转成一条私有知识笔记。中文输出，简洁、可行动，优先判断它对项目、想法、决策有什么用。sourceUrl 没有时返回 null。'
      },
      {
        role: 'user',
        content: JSON.stringify({ rawInput, fetchedPage: context || null }, null, 2)
      }
    ]
  });

  return parsed ? normalizeParsed(parsed, fallback) : fallback;
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const rawInput = typeof body?.input === 'string' ? body.input.trim() : '';
  if (!rawInput) {
    return NextResponse.json({ ok: false, message: '丢一个链接或一段文本进来。' }, { status: 400 });
  }

  const url = extractFirstUrl(rawInput);
  const context = url ? await fetchLinkContext(url).catch(() => undefined) : undefined;
  const fallback = fallbackParse(rawInput, url, context);
  const parsed = await aiParse(rawInput, fallback, context).catch(() => fallback);
  let created: KnowledgeNote;
  let embedding: { embedded: boolean; similar: { slug: string; title: string; score: number }[] };
  let note: KnowledgeNote;
  try {
    created = await createKnowledgeNote({
      ...parsed,
      status: 'raw',
      sourceUrl: parsed.sourceUrl || url,
      platform: detectPlatform({ sourceUrl: parsed.sourceUrl || url, rawText: rawInput, tags: parsed.tags }),
      rawExtract: context?.text?.slice(0, 1800) || rawInput.slice(0, 1800)
    });
    const analysis = await analyzeKnowledgeNote(created, getProjects(), getIdeas()).catch(() => undefined);
    if (analysis) created = await updateKnowledgeNote({ ...created, analysis, analyzedAt: localDate() });
    embedding = await embedKnowledgeNote(created).catch(() => ({ embedded: false, similar: [] }));
    note = embedding.similar.length
      ? {
        ...created,
        similar: embedding.similar
      }
      : created;
    if (note.similar?.length) await writeKnowledgeNote(note);
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }

  return NextResponse.json({
    ok: true,
    note,
    embedding,
    parser: getLlmConfig().apiKey ? 'ai' : 'fallback',
    message: getLlmConfig().apiKey
      ? `AI 已解析并写入知识脑${embedding.embedded ? '，embedding 已生成。' : '。'}`
      : '未配置 OPENAI_API_KEY，已用规则解析生成草稿。'
  });
}
