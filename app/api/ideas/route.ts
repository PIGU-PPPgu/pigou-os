import { NextResponse } from 'next/server';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getIdea, getKnowledge, getProjects } from '@/lib/data';
import type { Idea } from '@/lib/data';
import { analyzeIdea, localDate } from '@/lib/brain-analysis';
import { createIdea, updateIdea } from '@/lib/idea-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

const ideaStatuses = ['spark', 'validated', 'building', 'killed'] as const;

type ParsedIdea = {
  title: string;
  status: Idea['status'];
  score: number;
  summary: string;
  tags: string[];
  next: string;
};

function splitList(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input.split(/[\n,，|]/).map(item => item.trim()).filter(Boolean);
}

function fallbackParse(input: string): ParsedIdea {
  const title = input.slice(0, 48).replace(/\s+/g, ' ') || 'Untitled idea';
  const hasUserSignal = /用户|客户|老师|学生|班主任|痛点|需求|付费|复购/.test(input);
  const hasBuildSignal = /已经|正在|原型|demo|小程序|repo|代码|上线|发布/.test(input);
  return {
    title,
    status: hasBuildSignal ? 'validated' : 'spark',
    score: hasUserSignal ? 72 : 56,
    summary: input.slice(0, 220),
    tags: ['inbox'],
    next: '把这个想法补成一个可验证的小实验：目标用户、场景、验证方式、下一步动作。'
  };
}

function normalizeParsed(input: Partial<ParsedIdea>, fallback: ParsedIdea): ParsedIdea {
  const status = ideaStatuses.includes(input.status as Idea['status']) ? input.status as Idea['status'] : fallback.status;
  return {
    title: input.title?.trim() || fallback.title,
    status,
    score: Number.isFinite(input.score) ? Math.max(1, Math.min(100, Math.round(Number(input.score)))) : fallback.score,
    summary: input.summary?.trim() || fallback.summary,
    tags: Array.isArray(input.tags) && input.tags.length ? input.tags.map(String).filter(Boolean).slice(0, 8) : fallback.tags,
    next: input.next?.trim() || fallback.next
  };
}

async function aiParse(rawInput: string, fallback: ParsedIdea) {
  if (!getLlmConfig().apiKey) return fallback;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'status', 'score', 'summary', 'tags', 'next'],
    properties: {
      title: { type: 'string' },
      status: { type: 'string', enum: ideaStatuses },
      score: { type: 'number', minimum: 1, maximum: 100 },
      summary: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      next: { type: 'string' }
    }
  };

  const parsed = await createChatJson<Partial<ParsedIdea>>({
    schemaName: 'pigou_idea',
    schema,
    messages: [
      {
        role: 'system',
        content: '你是 Pigou OS 的 idea 评估器。把用户随手投喂的想法整理成项目雷达项。中文输出。score 衡量需求强度、可执行性、复利价值三者的综合，不要为了鼓励而虚高。'
      },
      { role: 'user', content: rawInput }
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
  const manualTitle = typeof body?.title === 'string' ? body.title.trim() : '';
  const manualSummary = typeof body?.summary === 'string' ? body.summary.trim() : '';
  const source = rawInput || [manualTitle, manualSummary].filter(Boolean).join('\n\n');
  if (!source) {
    return NextResponse.json({ ok: false, message: '先写一个想法、用户场景或产品判断。' }, { status: 400 });
  }

  const fallback = fallbackParse(source);
  const parsed = await aiParse(source, fallback).catch(() => fallback);
  const status = ideaStatuses.includes(body?.status) ? body.status : parsed.status;

  try {
    let idea = await createIdea({
      title: manualTitle || parsed.title,
      status,
      score: Number.isFinite(body?.score) ? Number(body.score) : parsed.score,
      summary: manualSummary || parsed.summary,
      tags: splitList(body?.tags).length ? splitList(body.tags) : parsed.tags,
      next: typeof body?.next === 'string' && body.next.trim() ? body.next.trim() : parsed.next
    });
    const analysis = await analyzeIdea(idea, getKnowledge(), getProjects()).catch(() => undefined);
    if (analysis) idea = await updateIdea({ ...idea, analysis, relatedKnowledge: analysis.evidenceLinks, analyzedAt: localDate() });
    return NextResponse.json({
      ok: true,
      idea,
      parser: getLlmConfig().apiKey ? 'ai' : 'fallback',
      message: getLlmConfig().apiKey ? 'AI 已整理并写入 idea 雷达。' : '未配置 OPENAI_API_KEY，已用规则生成 idea 草稿。'
    });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const idea = getIdea(slug);
  if (!idea) return NextResponse.json({ ok: false, message: 'Idea not found.' }, { status: 404 });

  try {
    const updated = await updateIdea({
      ...idea,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : idea.title,
      status: ideaStatuses.includes(body?.status) ? body.status : idea.status,
      score: Number.isFinite(body?.score) ? Math.max(1, Math.min(100, Math.round(Number(body.score)))) : idea.score,
      summary: typeof body?.summary === 'string' && body.summary.trim() ? body.summary.trim() : idea.summary,
      tags: splitList(body?.tags).length ? splitList(body.tags) : idea.tags,
      next: typeof body?.next === 'string' ? body.next.trim() || undefined : idea.next,
      relatedKnowledge: splitList(body?.relatedKnowledge).length ? splitList(body.relatedKnowledge) : idea.relatedKnowledge
    });
    return NextResponse.json({ ok: true, idea: updated });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
