import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { analyzeIdea, analyzeKnowledgeNote, detectPlatform, localDate } from '@/lib/brain-analysis';
import { getIdeas, getKnowledge, getProjects, type Project } from '@/lib/data';
import { createIdea, updateIdea } from '@/lib/idea-store';
import {
  classifyInboxInput,
  deriveIdeaInput,
  deriveKnowledgeInput,
  deriveLogInput,
  deriveTaskInput,
  normalizeInboxMode,
  splitInboxList,
  type InboxDraft
} from '@/lib/inbox-classifier';
import { createKnowledgeNote, updateKnowledgeNote } from '@/lib/knowledge-store';
import { createLog } from '@/lib/log-store';
import { StorageConfigurationError } from '@/lib/storage-guard';
import { createTask } from '@/lib/task-store';

type InboxIntegration = 'inbox' | 'shortcut' | 'feishu' | 'wecom';

type CaptureOptions = {
  integration?: InboxIntegration;
};

function mergeTags(...groups: unknown[]) {
  return Array.from(new Set(groups.flatMap(splitInboxList))).slice(0, 8);
}

function stringField(body: Record<string, unknown> | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = body?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function tryParseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractMessageContent(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const parsed = tryParseJsonObject(value);
    if (parsed) return stringField(parsed, 'text', 'content', 'url', 'link', 'title');
    return value.trim();
  }
  if (typeof value === 'object') {
    return extractWebhookInput(value as Record<string, unknown>);
  }
  return '';
}

export function extractWebhookInput(body: Record<string, unknown> | null): string {
  const direct = stringField(body, 'input', 'text', 'content', 'body', 'message', 'url', 'link');
  if (direct) return direct;

  const message = body?.message;
  if (message) {
    const messageText = extractMessageContent(message);
    if (messageText) return messageText;
  }

  const event = body?.event;
  if (event && typeof event === 'object') {
    const eventBody = event as Record<string, unknown>;
    const eventText = stringField(eventBody, 'input', 'text', 'content', 'body', 'message', 'url', 'link');
    if (eventText) return eventText;

    const eventMessage = eventBody.message;
    if (eventMessage && typeof eventMessage === 'object') {
      const messageBody = eventMessage as Record<string, unknown>;
      const contentText = extractMessageContent(messageBody.content);
      if (contentText) return contentText;
      const messageText = stringField(messageBody, 'text', 'content', 'body', 'message', 'url', 'link');
      if (messageText) return messageText;
    }
  }

  const data = body?.data;
  if (data && typeof data === 'object') {
    const dataBody = data as Record<string, unknown>;
    const dataText = stringField(dataBody, 'input', 'text', 'content', 'body', 'message', 'url', 'link');
    if (dataText) return dataText;
  }

  return '';
}

export async function readInboxBody(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : value.name]));
  }

  const text = await request.text().catch(() => '');
  if (!text.trim()) return null;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  if (contentType.includes('text/plain')) {
    return { input: text.trim() };
  }

  if (!contentType.includes('application/json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    return { input: text.trim() };
  }

  const parsed = JSON.parse(text) as unknown;
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : { input: String(parsed || '').trim() };
}

function webhookSecret() {
  return process.env.PIGOU_INBOX_WEBHOOK_SECRET || '';
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isInboxAuthorized(request: Request) {
  if (isAuthenticatedRequest(request)) return true;

  const secret = webhookSecret();
  if (!secret) return false;

  const url = new URL(request.url);
  const provided =
    request.headers.get('x-pigou-inbox-secret') ||
    getBearerToken(request) ||
    url.searchParams.get('secret') ||
    '';
  return Boolean(provided) && constantTimeEqual(provided, secret);
}

function applyOverrides(draft: InboxDraft, body: Record<string, unknown>) {
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : draft.title;
  const manualTags = mergeTags(body.tags);
  return {
    ...draft,
    title,
    tags: manualTags.length ? Array.from(new Set([...draft.tags, ...manualTags])).slice(0, 8) : draft.tags
  };
}

function applyProjectTags(draft: InboxDraft, input: string, projects: Project[]) {
  if (draft.target !== 'log' && draft.target !== 'task') return draft;
  const matches = findMentionedProjects(input, projects);
  if (!matches.length) return draft;
  return {
    ...draft,
    tags: Array.from(new Set([...draft.tags, ...matches.map(project => project.slug)])).slice(0, 8)
  };
}

function findMentionedProjects(input: string, projects: Project[]) {
  const haystack = input.toLowerCase();
  return projects.filter(project => {
    const slug = project.slug.toLowerCase();
    const title = project.title.toLowerCase();
    const linkHit = project.links?.some(link => link.url && haystack.includes(link.url.toLowerCase()));
    return haystack.includes(slug) || haystack.includes(title) || Boolean(linkHit);
  }).slice(0, 4);
}

function integrationTags(integration: InboxIntegration) {
  if (integration === 'inbox') return [];
  return [`source-${integration}`];
}

function unauthorizedMessage(integration: InboxIntegration) {
  if (integration === 'shortcut') return 'Shortcut 未授权：请在 URL query、Bearer token 或 x-pigou-inbox-secret 中带上 PIGOU_INBOX_WEBHOOK_SECRET。';
  if (integration === 'feishu') return '飞书入口未授权：请在自定义机器人/自动化请求里带上 PIGOU_INBOX_WEBHOOK_SECRET。';
  if (integration === 'wecom') return '企业微信入口未授权：请在 webhook 请求里带上 PIGOU_INBOX_WEBHOOK_SECRET。';
  return '请先登录 Pigou OS，或为 webhook 配置 PIGOU_INBOX_WEBHOOK_SECRET。';
}

export function maybeHandleWebhookChallenge(body: Record<string, unknown> | null, request?: Request) {
  if (typeof body?.challenge === 'string') {
    return NextResponse.json({ challenge: body.challenge });
  }

  const url = request ? new URL(request.url) : null;
  const echostr = url?.searchParams.get('echostr') || (typeof body?.echostr === 'string' ? body.echostr : '');
  if (echostr) return new NextResponse(echostr, { headers: { 'content-type': 'text/plain; charset=utf-8' } });

  return null;
}

export async function handleInboxCapture(request: Request, options: CaptureOptions = {}) {
  const integration = options.integration || 'inbox';
  const body = await readInboxBody(request).catch(() => null);
  const challenge = maybeHandleWebhookChallenge(body, request);
  if (challenge) return challenge;

  if (!isInboxAuthorized(request)) {
    return NextResponse.json({ ok: false, message: unauthorizedMessage(integration) }, { status: 401 });
  }

  const input = extractWebhookInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, message: '先贴一段文字、链接、截图描述、repo 或项目更新。Webhook 可用 input/text/url/content/message 字段。' }, { status: 400 });
  }

  const requestedMode = normalizeInboxMode(body?.mode);
  const projects = getProjects();
  const draft = applyProjectTags(applyOverrides(classifyInboxInput(input, requestedMode), {
    ...(body || {}),
    tags: mergeTags(body?.tags, integrationTags(integration))
  }), input, projects);

  try {
    if (draft.target === 'knowledge') {
      let note = await createKnowledgeNote({
        ...deriveKnowledgeInput(draft, input),
        platform: detectPlatform({ sourceUrl: draft.sourceUrl, rawText: input, tags: draft.tags })
      });
      const analysis = await analyzeKnowledgeNote(note, projects, getIdeas()).catch(() => undefined);
      if (analysis) note = await updateKnowledgeNote({ ...note, analysis, analyzedAt: localDate() });
      return NextResponse.json({
        ok: true,
        integration,
        mode: draft.target,
        requestedMode,
        reason: draft.reason,
        nextSuggestion: draft.nextSuggestion,
        note,
        item: note,
        message: `已写入知识脑：${note.title}`
      });
    }

    if (draft.target === 'idea') {
      let idea = await createIdea(deriveIdeaInput(draft, input));
      const analysis = await analyzeIdea(idea, getKnowledge(), projects).catch(() => undefined);
      if (analysis) idea = await updateIdea({ ...idea, analysis, relatedKnowledge: analysis.evidenceLinks, analyzedAt: localDate() });
      return NextResponse.json({
        ok: true,
        integration,
        mode: draft.target,
        requestedMode,
        reason: draft.reason,
        nextSuggestion: draft.nextSuggestion,
        idea,
        item: idea,
        message: `已写入 idea 雷达：${idea.title}`
      });
    }

    if (draft.target === 'task') {
      const derived = deriveTaskInput(draft, input);
      const task = await createTask({
        ...derived,
        priority: body?.priority === 'P0' || body?.priority === 'P1' || body?.priority === 'P2' ? body.priority : derived.priority,
        due: typeof body?.due === 'string' && body.due.trim() ? body.due.trim() : derived.due
      });
      return NextResponse.json({
        ok: true,
        integration,
        mode: draft.target,
        requestedMode,
        reason: draft.reason,
        nextSuggestion: draft.nextSuggestion,
        task,
        item: task,
        message: `已创建任务：${task.title}`
      });
    }

    const derived = deriveLogInput(draft, input);
    const log = await createLog({
      ...derived,
      date: typeof body?.date === 'string' && body.date.trim() ? body.date.trim() : derived.date || localDate()
    });
    return NextResponse.json({
      ok: true,
      integration,
      mode: draft.target,
      requestedMode,
      reason: draft.reason,
      nextSuggestion: draft.nextSuggestion,
      log,
      item: log,
      message: `已写入日志：${log.title}`
    });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
