import type { Idea, KnowledgeNote, Task } from '@/lib/data';

export const inboxModes = ['auto', 'knowledge', 'idea', 'task', 'log'] as const;
export type InboxMode = typeof inboxModes[number];
export type InboxTarget = Exclude<InboxMode, 'auto'>;

export type InboxDraft = {
  target: InboxTarget;
  title: string;
  summary: string;
  tags: string[];
  sourceUrl?: string;
  reason: string;
  nextSuggestion: string;
};

export function normalizeInboxMode(input: unknown): InboxMode {
  return inboxModes.includes(input as InboxMode) ? input as InboxMode : 'auto';
}

export function splitInboxList(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input.split(/[\n,，|#]/).map(item => item.trim()).filter(Boolean);
}

export function extractFirstUrl(input: string) {
  return input.match(/https?:\/\/[^\s"'<>]+/)?.[0]?.replace(/[),，。.!！?？]+$/, '');
}

export function classifyInboxInput(rawInput: string, requestedMode: InboxMode = 'auto'): InboxDraft {
  const input = rawInput.trim();
  const sourceUrl = extractFirstUrl(input);
  const lower = input.toLowerCase();
  const title = deriveTitle(input, sourceUrl);
  const summary = input.slice(0, 420);
  const tags = Array.from(new Set(['inbox', ...deriveTags(input, sourceUrl)])).slice(0, 8);

  if (requestedMode !== 'auto') {
    return { target: requestedMode, title, summary, tags, sourceUrl, reason: 'manual mode selected', nextSuggestion: nextSuggestionFor(requestedMode) };
  }

  if (looksLikeTaskCreation(lower, input)) {
    return { target: 'task', title, summary, tags, sourceUrl, reason: 'explicit task creation wording detected', nextSuggestion: nextSuggestionFor('task') };
  }
  if (looksLikeProjectUpdate(lower, input)) {
    return { target: 'log', title, summary, tags, sourceUrl, reason: 'project update wording detected', nextSuggestion: '已按项目进展写入日志；下一步可在日志里复盘阻塞、发布结果或后续动作。' };
  }
  if (looksLikeTask(lower, input)) {
    return { target: 'task', title, summary, tags, sourceUrl, reason: 'task/action wording detected', nextSuggestion: nextSuggestionFor('task') };
  }
  if (looksLikeLog(lower, input)) {
    return { target: 'log', title, summary, tags, sourceUrl, reason: 'review/log wording detected', nextSuggestion: nextSuggestionFor('log') };
  }
  if (looksLikeIdea(lower, input)) {
    return { target: 'idea', title, summary, tags, sourceUrl, reason: 'idea/opportunity wording detected', nextSuggestion: nextSuggestionFor('idea') };
  }
  if (sourceUrl || looksLikeKnowledge(lower, input)) {
    return { target: 'knowledge', title, summary, tags, sourceUrl, reason: sourceUrl ? 'link detected' : 'source/knowledge wording detected', nextSuggestion: nextSuggestionFor('knowledge') };
  }

  return { target: 'knowledge', title, summary, tags, sourceUrl, reason: 'default inbox destination', nextSuggestion: nextSuggestionFor('knowledge') };
}

export function deriveKnowledgeInput(draft: InboxDraft, rawInput: string): Omit<KnowledgeNote, 'slug' | 'capturedAt' | 'updated'> {
  const isLink = Boolean(draft.sourceUrl);
  return {
    title: draft.title,
    type: isLink ? 'source' : inferKnowledgeType(rawInput),
    status: 'raw',
    summary: draft.summary,
    keyPoints: deriveKeyPoints(rawInput, draft.sourceUrl),
    tags: draft.tags,
    relatedProjects: [],
    sourceUrl: draft.sourceUrl,
    confidence: 'medium',
    next: '判断这条内容应该关联到知识、想法、任务还是日志。',
    rawExtract: rawInput.slice(0, 1800)
  };
}

export function deriveIdeaInput(draft: InboxDraft, rawInput: string): Omit<Idea, 'slug' | 'updated'> {
  const hasUserSignal = /用户|客户|老师|学生|班主任|痛点|需求|付费|复购|user|customer|pain/.test(rawInput);
  const hasBuildSignal = /已经|正在|原型|demo|小程序|repo|代码|上线|发布|prototype|launched/.test(rawInput.toLowerCase());
  return {
    title: draft.title,
    status: hasBuildSignal ? 'validated' : 'spark',
    score: hasUserSignal ? 72 : 56,
    summary: draft.summary,
    tags: draft.tags,
    next: '把这个想法补成一个可验证的小实验：目标用户、场景、验证方式、下一步动作。'
  };
}

export function deriveTaskInput(draft: InboxDraft, rawInput: string): Omit<Task, 'slug' | 'createdAt' | 'updated'> {
  return {
    title: draft.title,
    status: 'next',
    priority: inferPriority(rawInput),
    sourceType: 'manual',
    sourceSlug: 'inbox',
    summary: draft.summary || 'Captured from unified inbox.',
    due: inferDueDate(rawInput)
  };
}

export function deriveLogInput(draft: InboxDraft, rawInput: string) {
  return {
    title: draft.title,
    content: rawInput,
    tags: draft.tags.length ? draft.tags : ['inbox'],
    date: inferLogDate(rawInput)
  };
}

function deriveTitle(input: string, sourceUrl?: string) {
  const firstLine = input.split(/\n+/).map(line => line.trim()).find(Boolean) || '';
  const withoutUrl = firstLine.replace(/https?:\/\/[^\s"'<>]+/g, '').trim();
  const candidate = withoutUrl || firstLine || sourceUrl || input;
  return candidate.replace(/^[-*#\s[\]xX.todo:：]+/i, '').replace(/\s+/g, ' ').slice(0, 72) || 'Inbox capture';
}

function deriveTags(input: string, sourceUrl?: string) {
  const lower = `${input}\n${sourceUrl || ''}`.toLowerCase();
  const tags: string[] = [];
  if (sourceUrl) tags.push('link');
  tags.push(...deriveProjectSlugTags(input, sourceUrl));
  if (/github|repo|代码|工程|bug|fix/.test(lower)) tags.push('dev');
  if (/ai|agent|llm|模型|智能体/.test(lower)) tags.push('ai');
  if (/用户|客户|需求|痛点|product|market/.test(lower)) tags.push('product');
  if (/老师|学生|班主任|教育|school|education/.test(lower)) tags.push('education');
  if (/决策|decision/.test(lower)) tags.push('decision');
  if (/复盘|review|daily|今天|卡住|发布|上线|完成/.test(lower)) tags.push('daily');
  return tags;
}

function deriveProjectSlugTags(input: string, sourceUrl?: string) {
  const tags: string[] = [];
  const text = `${input}\n${sourceUrl || ''}`;
  const githubRepo = text.match(/github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)/i);
  if (githubRepo) tags.push(slugTag(githubRepo[2]), slugTag(`${githubRepo[1]}-${githubRepo[2]}`));

  const projectMatches = text.matchAll(/(?:项目|project|repo|仓库)\s*[:：#-]?\s*([a-z0-9][a-z0-9_.-]{1,64})/gi);
  for (const match of projectMatches) tags.push(slugTag(match[1]));
  return tags.filter(Boolean).slice(0, 4);
}

function slugTag(input: string) {
  return input.toLowerCase().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}

function deriveKeyPoints(input: string, sourceUrl?: string) {
  const points = input
    .split(/\n+/)
    .map(line => line.trim().replace(/^[-*]\s*/, ''))
    .filter(line => line && line.length <= 180)
    .slice(0, 5);
  if (sourceUrl && !points.some(point => point.includes(sourceUrl))) points.unshift(`来源链接：${sourceUrl}`);
  return points.length ? points : [input.slice(0, 180)];
}

function inferKnowledgeType(input: string): KnowledgeNote['type'] {
  if (/决策|决定|decision/.test(input)) return 'decision';
  if (/问题|疑问|question|\?$|？$/.test(input)) return 'question';
  if (/素材|asset|图片|截图|文案/.test(input.toLowerCase())) return 'asset';
  if (/模式|pattern|规律/.test(input.toLowerCase())) return 'pattern';
  return 'insight';
}

function inferPriority(input: string): Task['priority'] {
  if (/p0|urgent|紧急|马上|今天|阻塞|blocker/i.test(input)) return 'P0';
  if (/p2|later|有空|低优先/i.test(input)) return 'P2';
  return 'P1';
}

function inferDueDate(input: string) {
  const explicit = input.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
  if (explicit) return explicit;
  return undefined;
}

function inferLogDate(input: string) {
  const explicit = input.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
  return explicit;
}

function looksLikeTask(lower: string, input: string) {
  return /^(\s*[-*]?\s*(todo|to do|next|action|fix|implement|ship|call|email|follow up|需要|要|记得|待办|下一步)[:：\s])/i.test(input)
    || /^\s*[-*]\s+\[[ xX]?\]/.test(input)
    || /\b(todo|fixme|next action|follow up|due)\b/.test(lower)
    || /^(今天|明天|本周).*(要|需要|完成|处理)/.test(input);
}

function looksLikeTaskCreation(lower: string, input: string) {
  return /^(生成任务|创建任务|新增任务|加任务|待办|todo|task)[:：\s]/i.test(input)
    || /(帮我|请|需要).*(生成|创建|新增|拆成).*(任务|待办|todo)/i.test(input)
    || /\b(create|add|generate)\s+(a\s+)?(task|todo)\b/.test(lower);
}

function looksLikeProjectUpdate(lower: string, input: string) {
  const hasProjectSubject = /项目|project|repo|仓库|github\.com/i.test(input);
  const hasProgressSignal = /今天|今日|刚刚|完成|推进|卡住|阻塞|下一步|发布|上线|部署|合并|修复|迭代|进展|更新|shipped|launched|blocked|released|deployed|merged/.test(lower);
  return hasProjectSubject && hasProgressSignal;
}

function looksLikeLog(lower: string, input: string) {
  return /^(log|daily|review|retro|复盘|日志|日记|今日|今天)[：:\s]/i.test(input)
    || /今天.*(完成|推进|学到|卡住|决定)/.test(input)
    || /\b(retrospective|standup|journal)\b/.test(lower);
}

function looksLikeIdea(lower: string, input: string) {
  return /^(idea|想法|脑洞|机会|假设)[：:\s]/i.test(input)
    || /(可以做|能不能|如果.*就|what if|product idea|用户.*痛点|需求.*验证|mvp)/i.test(input)
    || /\b(startup|opportunity|experiment)\b/.test(lower);
}

function looksLikeKnowledge(lower: string, input: string) {
  return /(资料|文章|论文|链接|摘录|quote|source|insight|洞察|笔记|知识|参考)/i.test(input)
    || input.length > 260
    || /\barxiv|doi|paper|research\b/.test(lower);
}

function nextSuggestionFor(target: InboxTarget) {
  if (target === 'knowledge') return '下一步可补充关键摘录、来源可信度，或等系统分析后关联项目和想法。';
  if (target === 'idea') return '下一步可把它补成一个小实验：目标用户、验证方式和第一步动作。';
  if (target === 'task') return '下一步可打开任务列表调整优先级、截止日期和项目归属。';
  return '下一步可在日志里继续补充结果、阻塞和明天要看的线索。';
}
