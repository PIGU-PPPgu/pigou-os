import type { Log, Project, ProjectProgressEvaluation, ProjectWikiSnapshot, Task } from '@/lib/data';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';

export type ProjectStatusSuggestion = {
  id: string;
  slug: string;
  title: string;
  currentStatus: Project['status'];
  suggestedStatus: Project['status'];
  currentProgress: number;
  suggestedProgress: number;
  suggestedNextActions: string[];
  evaluation: ProjectProgressEvaluation;
  confidence: 'low' | 'medium' | 'high';
  signals: string[];
  rationale: string;
  changed: boolean;
  ignored: boolean;
};

function daysSince(date?: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - parsed) / 86400000));
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniq(items: unknown[]) {
  return Array.from(new Set(items.map(item => typeof item === 'string' ? item.trim() : String(item ?? '').trim()).filter(Boolean)));
}

function stableHash(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function suggestionId(input: { project: Project; evaluation: ProjectProgressEvaluation; suggestedNextActions: string[] }) {
  const { project, evaluation, suggestedNextActions } = input;
  return stableHash(JSON.stringify({
    slug: project.slug,
    fromStatus: project.status,
    fromProgress: project.progress,
    toStatus: evaluation.status,
    toProgress: clampProgress(evaluation.progress),
    confidence: evaluation.confidence,
    evidence: [...evaluation.evidence.slice(0, 8)].sort(),
    risks: [...evaluation.risks.slice(0, 6)].sort(),
    nextActions: [...suggestedNextActions].sort()
  }));
}

function textCorpus(project: Project, wiki?: ProjectWikiSnapshot) {
  return [
    project.title,
    project.summary,
    project.explanation,
    ...(project.readme || []),
    wiki?.readme?.title,
    ...(wiki?.readme?.summary || [])
  ].filter(Boolean).join('\n').toLowerCase();
}

function statusFromSignals(project: Project, corpus: string, wiki?: ProjectWikiSnapshot) {
  if (project.status === 'archived') return 'archived';
  if (/已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus)) return 'shipped';
  if (wiki && daysSince(wiki.repo.pushedAt || wiki.generatedAt) > 150 && project.status !== 'shipped') return 'paused';
  if (wiki && wiki.fileTree.totalFiles > 20) return 'building';
  return project.status === 'paused' ? 'paused' : 'idea';
}

function progressFromSignals(project: Project, corpus: string, wiki?: ProjectWikiSnapshot, tasks: Task[] = [], logs: Log[] = []) {
  if (/已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus)) return Math.max(project.progress, 88);

  let score = project.status === 'idea' ? 18 : project.status === 'paused' ? 35 : project.status === 'building' ? 48 : project.progress;
  if (wiki) {
    if (wiki.fileTree.totalFiles > 0) score += 8;
    if (wiki.fileTree.totalFiles > 50) score += 8;
    if (wiki.fileTree.totalFiles > 300) score += 8;
    if (wiki.fileTree.totalFiles > 1000) score += 5;
    if (wiki.readme?.summary?.length) score += 6;
    if (wiki.frameworks.length) score += 5;
    if (wiki.entrypoints.length) score += 4;
    if (wiki.codeInsights) score += 6;
    if (wiki.gaps.some(gap => /package\.json|README|file tree/i.test(gap))) score -= 4;
    if (daysSince(wiki.repo.pushedAt || wiki.generatedAt) <= 30) score += 5;
  }
  if (project.images?.length) score += 6;
  if (logs.length) score += Math.min(6, logs.length * 2);
  if (tasks.some(task => task.status === 'done')) score += 4;
  if (tasks.some(task => task.status === 'doing')) score += 3;
  if (tasks.some(task => task.status === 'waiting')) score -= 3;
  return clampProgress(Math.max(project.progress - 8, Math.min(project.progress + 18, score)));
}

function nextActionsFromSignals(project: Project, wiki?: ProjectWikiSnapshot, tasks: Task[] = []) {
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status)).slice(0, 2).map(task => task.title);
  const actions = [...openTasks];
  if (!wiki) actions.push('Run GitHub/wiki sync to create a code understanding snapshot.');
  if (wiki && !wiki.codeInsights) actions.push('Generate LLM code insights for the most important source files.');
  if (wiki?.gaps.some(gap => /package\.json/i.test(gap))) actions.push('Clarify runtime stack and entrypoint because package metadata is missing.');
  if (!project.images?.some(image => image.public)) actions.push('Add one approved public screenshot or product surface image.');
  actions.push(...project.nextActions.slice(0, 2).map(String));
  return uniq(actions).slice(0, 4);
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function buildSignalPack(project: Project, wiki?: ProjectWikiSnapshot, tasks: Task[] = [], logs: Log[] = []) {
  return {
    project: {
      slug: project.slug,
      title: project.title,
      currentStatus: project.status,
      currentProgress: project.progress,
      priority: project.priority,
      summary: project.summary,
      explanation: project.explanation,
      domain: project.domain,
      visibility: project.visibility,
      goals: project.goals,
      nextActions: project.nextActions,
      readme: project.readme?.slice(0, 8),
      imageCount: project.images?.length || 0,
      publicImageCount: project.images?.filter(image => image.public).length || 0,
      updated: project.updated
    },
    githubWiki: wiki ? {
      repo: wiki.repo,
      generatedAt: wiki.generatedAt,
      totalFiles: wiki.fileTree.totalFiles,
      topDirectories: wiki.fileTree.topDirectories.slice(0, 10),
      extensions: wiki.fileTree.extensions.slice(0, 10),
      frameworks: wiki.frameworks,
      package: wiki.package,
      entrypoints: wiki.entrypoints.slice(0, 10),
      modules: wiki.modules.slice(0, 8),
      importantFiles: wiki.importantFiles.slice(0, 10),
      gaps: wiki.gaps,
      readme: wiki.readme,
      codeInsights: wiki.codeInsights ? {
        generatedAt: wiki.codeInsights.generatedAt,
        architectureSummary: wiki.codeInsights.architectureSummary,
        modules: wiki.codeInsights.modules.slice(0, 8),
        risks: wiki.codeInsights.risks.slice(0, 8),
        nextQuestions: wiki.codeInsights.nextQuestions.slice(0, 8)
      } : null
    } : null,
    tasks: tasks.slice(0, 12),
    logs: logs.slice(0, 8)
  };
}

function fallbackEvaluation(project: Project, wiki?: ProjectWikiSnapshot, tasks: Task[] = [], logs: Log[] = []): ProjectProgressEvaluation {
  const corpus = textCorpus(project, wiki);
  const suggestedStatus = statusFromSignals(project, corpus, wiki);
  const suggestedProgress = progressFromSignals(project, corpus, wiki, tasks, logs);
  const suggestedNextActions = nextActionsFromSignals(project, wiki, tasks);
  const technical = clampProgress((wiki?.fileTree.totalFiles || 0) > 300 ? 20 : (wiki?.fileTree.totalFiles || 0) > 50 ? 16 : (wiki?.fileTree.totalFiles || 0) > 0 ? 10 : 2);
  const product = clampProgress(project.status === 'shipped' ? 25 : project.status === 'building' ? 16 : project.status === 'paused' ? 10 : 5);
  const usage = /已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus) ? 25 : project.images?.length ? 10 : 4;
  const documentation = clampProgress((project.readme?.length ? 5 : 0) + (wiki?.readme?.summary?.length ? 6 : 0) + (wiki?.codeInsights ? 4 : 0));
  const momentum = clampProgress((wiki && daysSince(wiki.repo.pushedAt || wiki.generatedAt) <= 30 ? 8 : 2) + (logs.length ? Math.min(4, logs.length) : 0) + (tasks.some(task => task.status === 'doing') ? 3 : 0));
  return {
    generatedAt: localDate(),
    model: 'local-signal-engine',
    source: 'algorithm',
    progress: suggestedProgress,
    status: suggestedStatus,
    confidence: wiki && (tasks.length || logs.length || wiki.readme?.summary?.length) ? 'medium' : 'low',
    summary: '基于 GitHub/wiki 快照、任务、日志、图片素材和项目文本自动计算的进度建议。',
    rationale: '未调用到 LLM 时，Pigou OS 使用本地信号引擎生成可解释的候选分数；有模型配置时会优先交给 AI 复核。',
    dimensions: [
      { name: 'product_readiness', score: product, max: 25, reason: '项目状态、可用性描述和产品形态信号。' },
      { name: 'technical_completeness', score: technical, max: 20, reason: '仓库文件规模、框架、入口、模块和代码洞察。' },
      { name: 'usage_validation', score: usage, max: 25, reason: '是否已经上线、投入使用、可演示或有真实截图。' },
      { name: 'documentation_knowledge', score: documentation, max: 15, reason: 'README、wiki、代码理解和项目说明完整度。' },
      { name: 'momentum', score: momentum, max: 15, reason: '近期提交、任务推进和日志记录。' }
    ],
    evidence: [
      wiki ? `repo files: ${wiki.fileTree.totalFiles}` : 'no GitHub/wiki snapshot',
      wiki?.repo.pushedAt ? `last push: ${wiki.repo.pushedAt.slice(0, 10)}` : '',
      project.images?.length ? `images: ${project.images.length}` : '',
      tasks.length ? `linked tasks: ${tasks.length}` : '',
      logs.length ? `linked logs: ${logs.length}` : ''
    ].filter(Boolean),
    risks: wiki?.gaps?.slice(0, 4) || [],
    nextActions: suggestedNextActions
  };
}

async function aiEvaluation(project: Project, wiki?: ProjectWikiSnapshot, tasks: Task[] = [], logs: Log[] = []) {
  const fallback = fallbackEvaluation(project, wiki, tasks, logs);
  const config = getLlmConfig();
  if (!config.apiKey) return fallback;

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['progress', 'status', 'confidence', 'summary', 'rationale', 'dimensions', 'evidence', 'risks', 'nextActions'],
    properties: {
      progress: { type: 'number', minimum: 0, maximum: 100 },
      status: { type: 'string', enum: ['idea', 'building', 'paused', 'shipped', 'archived'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      summary: { type: 'string' },
      rationale: { type: 'string' },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'score', 'max', 'reason'],
          properties: {
            name: { type: 'string' },
            score: { type: 'number' },
            max: { type: 'number' },
            reason: { type: 'string' }
          }
        }
      },
      evidence: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      nextActions: { type: 'array', items: { type: 'string' } }
    }
  };

  const parsed = await createChatJson<Omit<ProjectProgressEvaluation, 'generatedAt' | 'model' | 'source'>>({
    schemaName: 'pigou_project_progress_evaluation',
    schema,
    messages: [
      {
        role: 'system',
        content: [
          '你是 Pigou OS 的项目进度评估器。你的任务是根据事实信号自动判断项目状态、进度和下一步。',
          '不要使用人工区间模板，也不要根据投入时间估分。只根据证据：仓库结构、代码洞察、README、任务、日志、截图、真实使用/上线信号。',
          '如果证据不足，降低 confidence，不要编造。private 项目可以基于提供的私有摘要评估，但不要要求公开敏感细节。',
          'progress 是 0-100 的工程/产品综合成熟度；status 必须是 idea/building/paused/shipped/archived。',
          '中文输出，简洁、具体、可执行。'
        ].join('\n')
      },
      { role: 'user', content: JSON.stringify({ signalPack: buildSignalPack(project, wiki, tasks, logs), fallback }, null, 2) }
    ]
  }).catch(() => null);

  if (!parsed) return fallback;
  const nextActions = Array.isArray(parsed.nextActions) && parsed.nextActions.length ? parsed.nextActions.slice(0, 4) : fallback.nextActions;
  return {
    generatedAt: localDate(),
    model: config.model,
    source: 'ai' as const,
    progress: clampProgress(Number(parsed.progress)),
    status: ['idea', 'building', 'paused', 'shipped', 'archived'].includes(parsed.status) ? parsed.status : fallback.status,
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : fallback.confidence,
    summary: String(parsed.summary || fallback.summary),
    rationale: String(parsed.rationale || fallback.rationale),
    dimensions: Array.isArray(parsed.dimensions) && parsed.dimensions.length ? parsed.dimensions.slice(0, 6).map(dimension => ({
      name: String(dimension.name || 'signal'),
      score: clampProgress(Number(dimension.score || 0)),
      max: Math.max(1, Math.round(Number(dimension.max || 100))),
      reason: String(dimension.reason || '')
    })) : fallback.dimensions,
    evidence: Array.isArray(parsed.evidence) && parsed.evidence.length ? parsed.evidence.slice(0, 8).map(String) : fallback.evidence,
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 6).map(String) : fallback.risks,
    nextActions
  };
}

export async function suggestProjectStatus(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[] }): Promise<ProjectStatusSuggestion> {
  const { project, wiki, tasks = [], logs = [] } = input;
  const evaluation = await aiEvaluation(project, wiki, tasks, logs);
  const suggestedStatus = evaluation.status;
  const suggestedProgress = evaluation.progress;
  const suggestedNextActions = evaluation.nextActions;
  const signals = [
    wiki ? `repo files: ${wiki.fileTree.totalFiles}` : 'no repo wiki snapshot',
    wiki?.repo.pushedAt ? `last push: ${wiki.repo.pushedAt.slice(0, 10)}` : '',
    wiki?.readme?.summary?.length ? `README summary: ${wiki.readme.summary.length}` : '',
    wiki?.frameworks.length ? `frameworks: ${wiki.frameworks.join(', ')}` : '',
    project.images?.length ? `images: ${project.images.length}` : '',
    tasks.length ? `linked tasks: ${tasks.length}` : '',
    logs.length ? `linked logs: ${logs.length}` : '',
    `evaluator: ${evaluation.source}/${evaluation.model}`
  ].filter(Boolean);
  const confidence = evaluation.confidence;
  const changed = suggestedStatus !== project.status || Math.abs(suggestedProgress - project.progress) >= 4 || suggestedNextActions.some(action => !project.nextActions.includes(action));
  const rationale = evaluation.rationale;
  const id = suggestionId({ project, evaluation, suggestedNextActions });
  const ignored = project.statusSuggestionReview?.id === id && project.statusSuggestionReview.action === 'ignored';
  return { id, slug: project.slug, title: project.title, currentStatus: project.status, suggestedStatus, currentProgress: project.progress, suggestedProgress, suggestedNextActions, evaluation, confidence, signals, rationale, changed, ignored };
}
