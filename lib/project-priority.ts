import type { Log, Project, ProjectPriority, ProjectPrioritySuggestion, ProjectWikiSnapshot, Task } from '@/lib/data';

export type ProjectPriorityAdvice = {
  id: string;
  slug: string;
  title: string;
  currentPriority: ProjectPriority;
  suggestedPriority: ProjectPriority;
  confidence: ProjectPrioritySuggestion['confidence'];
  score: number;
  suggestion: ProjectPrioritySuggestion;
  evidence: string[];
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

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
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

function textCorpus(project: Project, wiki?: ProjectWikiSnapshot) {
  return [
    project.title,
    project.summary,
    project.explanation,
    project.domain,
    project.source,
    ...(project.goals || []),
    ...(project.nextActions || []),
    ...(project.readme || []),
    wiki?.readme?.title,
    ...(wiki?.readme?.summary || []),
    wiki?.codeInsights?.architectureSummary,
    ...(wiki?.codeInsights?.nextQuestions || [])
  ].filter(Boolean).join('\n').toLowerCase();
}

function priorityFromScore(project: Project, score: number): ProjectPriority {
  if (project.status === 'archived') return 'low';
  if (score >= 72) return 'high';
  if (score >= 42) return 'medium';
  return 'low';
}

function confidenceFromSignals(wiki: ProjectWikiSnapshot | undefined, tasks: Task[], logs: Log[], evidence: string[]): ProjectPrioritySuggestion['confidence'] {
  const signalCount = (wiki ? 2 : 0) + Math.min(tasks.length, 3) + Math.min(logs.length, 2) + Math.min(evidence.length, 4);
  if (signalCount >= 7) return 'high';
  if (signalCount >= 3) return 'medium';
  return 'low';
}

export function computeProjectPrioritySuggestion(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[]; model?: string }): ProjectPrioritySuggestion {
  const { project, wiki, tasks = [], logs = [], model = 'local-priority-signal-engine' } = input;
  const corpus = textCorpus(project, wiki);
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status));
  const daysFromProjectUpdate = daysSince(project.updated);
  const daysFromRepoPush = daysSince(wiki?.repo.pushedAt || wiki?.generatedAt);
  const hasLaunchSignal = /已投入正常使用|投入正常使用|上线|已发布|发布|shipped|launched|production|用户|客户|真实使用|deploy|deployed/.test(corpus);
  const hasStrategicSignal = /pigou os|today|quick capture|github|deepwiki|llm wiki|知识脑|自动同步|工作流|入口|驾驶舱|生活状态/.test(corpus);
  const p0Count = openTasks.filter(task => task.priority === 'P0').length;
  const p1Count = openTasks.filter(task => task.priority === 'P1').length;
  const doingCount = openTasks.filter(task => task.status === 'doing').length;
  const waitingCount = openTasks.filter(task => task.status === 'waiting').length;
  const recentLogs = logs.filter(log => daysSince(log.date) <= 30).length;
  const recentRepo = daysFromRepoPush <= 14;
  const recentProject = daysFromProjectUpdate <= 21;
  const totalFiles = wiki?.fileTree.totalFiles || 0;

  const urgency = clampScore((p0Count * 18) + (p1Count * 7) + (doingCount * 10) - (waitingCount * 5));
  const momentum = clampScore((recentRepo ? 24 : daysFromRepoPush <= 45 ? 12 : 0) + (recentProject ? 10 : 0) + Math.min(18, recentLogs * 6));
  const strategic = clampScore((project.status === 'building' ? 18 : project.status === 'shipped' ? 14 : project.status === 'idea' ? 8 : 0) + (hasStrategicSignal ? 20 : 0) + (project.visibility === 'private' ? 5 : 0));
  const maturity = clampScore((project.progress >= 70 ? 14 : project.progress >= 35 ? 10 : 4) + (hasLaunchSignal ? 18 : 0) + (project.images?.length ? 6 : 0) + (totalFiles > 300 ? 10 : totalFiles > 30 ? 6 : totalFiles > 0 ? 3 : 0));
  const stalenessPenalty = project.status === 'paused' ? 18 : project.status === 'archived' ? 55 : Math.min(22, Math.max(0, daysFromProjectUpdate - 90) / 6) + (daysFromRepoPush > 150 ? 14 : 0);

  const score = clampScore(18 + (urgency * 0.28) + (momentum * 0.25) + (strategic * 0.25) + (maturity * 0.22) - stalenessPenalty);
  const suggestedPriority = priorityFromScore(project, score);
  const evidence = uniq([
    openTasks.length ? `open tasks: ${openTasks.length} (${p0Count} P0, ${p1Count} P1, ${doingCount} doing)` : 'no open linked tasks',
    wiki ? `repo files: ${totalFiles}` : 'no GitHub/wiki snapshot',
    wiki?.repo.pushedAt ? `last push: ${wiki.repo.pushedAt.slice(0, 10)}` : '',
    recentLogs ? `recent logs: ${recentLogs}` : logs.length ? `linked logs: ${logs.length}` : '',
    hasLaunchSignal ? 'launch/use signal in project text' : '',
    hasStrategicSignal ? 'strategic OS/workflow signal in project text' : '',
    project.status === 'paused' || project.status === 'archived' ? `status penalty: ${project.status}` : '',
    project.progressEvaluation ? `progress evaluation: ${project.progressEvaluation.progress}% ${project.progressEvaluation.status}` : ''
  ]);
  const confidence = confidenceFromSignals(wiki, tasks, logs, evidence);
  const dimensions = [
    { name: 'urgency', score: urgency, max: 100, reason: 'Open P0/P1 tasks and active doing items.' },
    { name: 'momentum', score: momentum, max: 100, reason: 'Recent repository pushes, project updates, and log activity.' },
    { name: 'strategic_fit', score: strategic, max: 100, reason: 'Current lifecycle state plus Pigou OS/workflow/life-state relevance.' },
    { name: 'maturity_or_impact', score: maturity, max: 100, reason: 'Progress, shipped/use signals, screenshots, and repository scale.' },
    { name: 'staleness_penalty', score: clampScore(stalenessPenalty), max: 100, reason: 'Paused, archived, or stale projects should cool down unless other signals are strong.' }
  ];
  const rationale = [
    `综合分 ${score}/100，建议为 ${suggestedPriority}。`,
    '这个值来自任务紧急度、近期动量、战略相关性、成熟/影响证据和停滞惩罚；它只是候选建议，只有 apply 后才会改项目 priority。'
  ].join(' ');
  const id = stableHash(JSON.stringify({
    slug: project.slug,
    currentPriority: project.priority,
    suggestedPriority,
    confidence,
    score,
    evidence: evidence.slice(0, 8).sort()
  }));

  return {
    id,
    generatedAt: localDate(),
    model,
    source: 'algorithm',
    currentPriority: project.priority,
    suggestedPriority,
    confidence,
    score,
    rationale,
    evidence,
    dimensions
  };
}

export function suggestProjectPriority(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[]; model?: string }): ProjectPriorityAdvice {
  const suggestion = computeProjectPrioritySuggestion(input);
  const { project } = input;
  const ignored = project.prioritySuggestionReview?.id === suggestion.id && project.prioritySuggestionReview.action === 'ignored';
  return {
    id: suggestion.id,
    slug: project.slug,
    title: project.title,
    currentPriority: project.priority,
    suggestedPriority: suggestion.suggestedPriority,
    confidence: suggestion.confidence,
    score: suggestion.score,
    suggestion,
    evidence: suggestion.evidence,
    rationale: suggestion.rationale,
    changed: suggestion.suggestedPriority !== project.priority,
    ignored
  };
}
