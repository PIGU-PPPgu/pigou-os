import { getIdeas, getKnowledge, getLogs, getProjects, getSyncJobs, getTasks, type Idea, type KnowledgeNote, type Log, type Project, type SyncJob, type Task } from '@/lib/data';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';

type BriefSource = 'projects' | 'tasks' | 'knowledge' | 'ideas' | 'logs' | 'sync';

export type WeeklyBriefItem = {
  title: string;
  summary: string;
  source: BriefSource;
  slug?: string;
  date?: string;
  score: number;
};

export type WeeklyBriefProjectSignal = {
  slug: string;
  title: string;
  status: Project['status'];
  priority: Project['priority'];
  progress: number;
  updated: string;
  signal: string;
  nextActions: string[];
};

export type WeeklyBriefSyncSignal = {
  id: string;
  repo: string;
  status: SyncJob['status'];
  requestedAt: string;
  summary: string;
};

export type WeeklyBriefStats = {
  projects: number;
  activeProjects: number;
  updatedProjects: number;
  tasks: number;
  openTasks: number;
  doneTasks: number;
  knowledge: number;
  linkedKnowledge: number;
  ideas: number;
  highScoreIdeas: number;
  logs: number;
  syncJobs: number;
  syncNeedsReview: number;
};

export type WeeklyBrief = {
  generatedAt: string;
  range: { start: string; end: string; days: number };
  synthesis: {
    source: 'local' | 'llm';
    model: string;
    title: string;
    executiveSummary: string;
    focusScore: number;
    wins: string[];
    risks: string[];
    nextActions: string[];
    questions: string[];
  };
  stats: WeeklyBriefStats;
  highlights: WeeklyBriefItem[];
  projectSignals: WeeklyBriefProjectSignal[];
  syncSignals: WeeklyBriefSyncSignal[];
};

type WeeklyBriefInput = {
  generatedAt: string;
  range: { start: string; end: string; days: number };
  projects: Project[];
  tasks: Task[];
  knowledge: KnowledgeNote[];
  ideas: Idea[];
  logs: Log[];
  syncJobs: SyncJob[];
};

type LlmBriefSynthesis = WeeklyBrief['synthesis'];

const llmSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'model', 'title', 'executiveSummary', 'focusScore', 'wins', 'risks', 'nextActions', 'questions'],
  properties: {
    source: { type: 'string', enum: ['llm'] },
    model: { type: 'string' },
    title: { type: 'string' },
    executiveSummary: { type: 'string' },
    focusScore: { type: 'number' },
    wins: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    nextActions: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } }
  }
};

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days + 1);
  return localDate(date);
}

function inRange(value: string | undefined, start: string, end: string) {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= start && date <= end;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function firstLine(value: string, fallback: string) {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
}

function briefInput(days: number): WeeklyBriefInput {
  const safeDays = Math.max(1, Math.min(31, Math.round(days || 7)));
  const end = localDate();
  const start = daysAgo(safeDays);
  return {
    generatedAt: new Date().toISOString(),
    range: { start, end, days: safeDays },
    projects: getProjects(),
    tasks: getTasks(),
    knowledge: getKnowledge(),
    ideas: getIdeas(),
    logs: getLogs(),
    syncJobs: getSyncJobs()
  };
}

function stats(input: WeeklyBriefInput): WeeklyBriefStats {
  const { start, end } = input.range;
  const openTasks = input.tasks.filter(task => task.status !== 'done' && task.status !== 'archived');
  return {
    projects: input.projects.length,
    activeProjects: input.projects.filter(project => project.status === 'building').length,
    updatedProjects: input.projects.filter(project => inRange(project.updated, start, end)).length,
    tasks: input.tasks.filter(task => inRange(task.updated, start, end) || inRange(task.createdAt, start, end)).length,
    openTasks: openTasks.length,
    doneTasks: input.tasks.filter(task => task.status === 'done' && inRange(task.updated, start, end)).length,
    knowledge: input.knowledge.filter(note => inRange(note.updated, start, end) || inRange(note.capturedAt, start, end)).length,
    linkedKnowledge: input.knowledge.filter(note => note.status === 'linked').length,
    ideas: input.ideas.filter(idea => inRange(idea.updated, start, end)).length,
    highScoreIdeas: input.ideas.filter(idea => idea.score >= 75).length,
    logs: input.logs.filter(log => inRange(log.date, start, end)).length,
    syncJobs: input.syncJobs.filter(job => inRange(job.requestedAt, start, end)).length,
    syncNeedsReview: input.syncJobs.filter(job => job.status === 'failed' || job.status === 'needs-review').length
  };
}

function highlightItems(input: WeeklyBriefInput): WeeklyBriefItem[] {
  const { start, end } = input.range;
  const projectItems = input.projects
    .filter(project => project.status === 'building' || project.priority === 'high' || inRange(project.updated, start, end))
    .map(project => ({
      title: project.title,
      summary: project.progressEvaluation?.summary || project.summary,
      source: 'projects' as const,
      slug: project.slug,
      date: project.updated,
      score: clampScore((project.priority === 'high' ? 30 : 0) + (project.status === 'building' ? 25 : 0) + project.progress)
    }));

  const taskItems = input.tasks
    .filter(task => task.status !== 'archived' && (task.priority === 'P0' || task.status === 'doing' || inRange(task.updated, start, end)))
    .map(task => ({
      title: task.title,
      summary: task.summary,
      source: 'tasks' as const,
      slug: task.slug,
      date: task.updated,
      score: clampScore((task.priority === 'P0' ? 70 : task.priority === 'P1' ? 52 : 34) + (task.status === 'doing' ? 18 : 0))
    }));

  const knowledgeItems = input.knowledge
    .filter(note => note.status === 'linked' || inRange(note.updated, start, end) || inRange(note.capturedAt, start, end))
    .map(note => ({
      title: note.title,
      summary: note.summary,
      source: 'knowledge' as const,
      slug: note.slug,
      date: note.updated,
      score: clampScore((note.status === 'linked' ? 55 : 35) + (note.confidence === 'high' ? 20 : note.confidence === 'medium' ? 10 : 0))
    }));

  const ideaItems = input.ideas
    .filter(idea => idea.score >= 70 || inRange(idea.updated, start, end))
    .map(idea => ({
      title: idea.title,
      summary: idea.summary,
      source: 'ideas' as const,
      slug: idea.slug,
      date: idea.updated,
      score: clampScore(idea.score)
    }));

  const logItems = input.logs
    .filter(log => inRange(log.date, start, end))
    .map(log => ({
      title: log.title,
      summary: firstLine(log.content, 'Weekly log entry'),
      source: 'logs' as const,
      slug: log.slug,
      date: log.date,
      score: clampScore(58 + Math.min(20, log.tags.length * 4))
    }));

  const syncItems = input.syncJobs
    .filter(job => inRange(job.requestedAt, start, end) || job.status === 'failed' || job.status === 'needs-review')
    .map(job => ({
      title: job.repo.fullName,
      summary: job.summary || job.error || job.event || 'Sync job waiting for worker',
      source: 'sync' as const,
      slug: job.id,
      date: job.requestedAt,
      score: clampScore(job.status === 'failed' || job.status === 'needs-review' ? 86 : job.status === 'success' ? 62 : 48)
    }));

  return [...projectItems, ...taskItems, ...knowledgeItems, ...ideaItems, ...logItems, ...syncItems]
    .sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''))
    .slice(0, 14);
}

function projectSignals(input: WeeklyBriefInput): WeeklyBriefProjectSignal[] {
  const tasksByProject = new Map<string, Task[]>();
  input.tasks.forEach(task => {
    if (!task.projectSlug) return;
    tasksByProject.set(task.projectSlug, [...(tasksByProject.get(task.projectSlug) || []), task]);
  });

  return input.projects
    .filter(project => project.status !== 'archived')
    .map(project => {
      const tasks = tasksByProject.get(project.slug) || [];
      const openTasks = tasks.filter(task => task.status !== 'done' && task.status !== 'archived');
      const signal = project.progressEvaluation?.summary
        || (openTasks[0] ? `${openTasks.length} open task(s), next: ${openTasks[0].title}` : project.summary);
      return {
        slug: project.slug,
        title: project.title,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        updated: project.updated,
        signal,
        nextActions: project.nextActions.slice(0, 3)
      };
    })
    .sort((a, b) => {
      const statusA = a.status === 'building' ? 0 : a.status === 'paused' ? 1 : 2;
      const statusB = b.status === 'building' ? 0 : b.status === 'paused' ? 1 : 2;
      return statusA - statusB || b.updated.localeCompare(a.updated);
    })
    .slice(0, 8);
}

function syncSignals(input: WeeklyBriefInput): WeeklyBriefSyncSignal[] {
  return input.syncJobs.slice(0, 8).map(job => ({
    id: job.id,
    repo: job.repo.fullName,
    status: job.status,
    requestedAt: job.requestedAt,
    summary: job.summary || job.error || job.event || 'waiting for worker'
  }));
}

function localSynthesis(input: WeeklyBriefInput, computedStats: WeeklyBriefStats, highlights: WeeklyBriefItem[]): WeeklyBrief['synthesis'] {
  const active = input.projects.filter(project => project.status === 'building');
  const pausedHigh = input.projects.filter(project => project.status === 'paused' && project.priority === 'high');
  const reviewJobs = input.syncJobs.filter(job => job.status === 'failed' || job.status === 'needs-review');
  const doingTasks = input.tasks.filter(task => task.status === 'doing');
  const p0Tasks = input.tasks.filter(task => task.priority === 'P0' && task.status !== 'done' && task.status !== 'archived');
  const linkedRatio = input.knowledge.length ? computedStats.linkedKnowledge / input.knowledge.length : 0;
  const focusScore = clampScore(48 + active.length * 7 + computedStats.doneTasks * 5 + linkedRatio * 18 - pausedHigh.length * 8 - reviewJobs.length * 7);
  const leadProject = active[0] || input.projects.find(project => project.priority === 'high') || input.projects[0];

  const wins = [
    computedStats.updatedProjects ? `${computedStats.updatedProjects} project(s) changed during the week.` : 'Project registry stayed stable this week.',
    computedStats.knowledge ? `${computedStats.knowledge} knowledge note(s) entered or changed.` : 'No new knowledge note landed in the weekly window.',
    computedStats.syncJobs ? `${computedStats.syncJobs} sync job(s) refreshed external evidence.` : 'Sync layer had no new weekly job.'
  ];
  const risks = [
    ...pausedHigh.map(project => `${project.title} is high priority but paused.`),
    ...reviewJobs.slice(0, 3).map(job => `${job.repo.fullName} sync is ${job.status}.`),
    ...(computedStats.openTasks > 8 ? [`${computedStats.openTasks} open task(s) may dilute execution focus.`] : [])
  ].slice(0, 5);
  const nextActions = [
    ...p0Tasks.slice(0, 3).map(task => task.title),
    ...doingTasks.slice(0, 2).map(task => task.title),
    ...(leadProject?.nextActions.slice(0, 2) || [])
  ].filter((action, index, list) => action && list.indexOf(action) === index).slice(0, 6);
  const questions = [
    leadProject ? `What would make ${leadProject.title} visibly more real by next week?` : 'Which project should become the main weekly bet?',
    reviewJobs.length ? 'Which sync failure is blocking the freshest project evidence?' : 'Which external signal should be synced before the next progress evaluation?',
    highlights[0] ? `Does "${highlights[0].title}" deserve a concrete task or project update?` : 'What evidence is missing from the private brain?'
  ];

  return {
    source: 'local',
    model: 'deterministic-local',
    title: `${input.range.start} to ${input.range.end} weekly brief`,
    executiveSummary: leadProject
      ? `${leadProject.title} is the main visible thread. The system shows ${computedStats.activeProjects} active project(s), ${computedStats.openTasks} open task(s), ${computedStats.knowledge} weekly knowledge change(s), and ${computedStats.syncNeedsReview} sync item(s) needing review.`
      : `The system has ${computedStats.projects} project(s), ${computedStats.openTasks} open task(s), and ${computedStats.knowledge} weekly knowledge change(s).`,
    focusScore,
    wins,
    risks: risks.length ? risks : ['No sharp weekly risk surfaced from the local data.'],
    nextActions: nextActions.length ? nextActions : ['Choose one project, one evidence source, and one task to advance before the next brief.'],
    questions
  };
}

function llmPayload(input: WeeklyBriefInput, computedStats: WeeklyBriefStats, highlights: WeeklyBriefItem[]) {
  return {
    range: input.range,
    stats: computedStats,
    highlights,
    projects: input.projects.slice(0, 16).map(project => ({
      title: project.title,
      slug: project.slug,
      status: project.status,
      priority: project.priority,
      progress: project.progress,
      summary: project.summary,
      progressEvaluation: project.progressEvaluation?.summary,
      nextActions: project.nextActions.slice(0, 4),
      updated: project.updated
    })),
    tasks: input.tasks.slice(0, 20),
    knowledge: input.knowledge.slice(0, 18).map(note => ({
      title: note.title,
      status: note.status,
      confidence: note.confidence,
      summary: note.summary,
      next: note.next,
      relatedProjects: note.relatedProjects,
      updated: note.updated
    })),
    ideas: input.ideas.slice(0, 12).map(idea => ({
      title: idea.title,
      status: idea.status,
      score: idea.score,
      summary: idea.summary,
      next: idea.next,
      updated: idea.updated
    })),
    logs: input.logs.slice(0, 10),
    syncJobs: input.syncJobs.slice(0, 12)
  };
}

async function maybeLlmSynthesis(input: WeeklyBriefInput, computedStats: WeeklyBriefStats, highlights: WeeklyBriefItem[], enabled: boolean) {
  if (!enabled || !getLlmConfig().apiKey) return null;
  const config = getLlmConfig();
  const result = await createChatJson<LlmBriefSynthesis>({
    schemaName: 'weekly_brief_synthesis',
    schema: llmSchema,
    messages: [
      {
        role: 'system',
        content: 'You produce concise internal weekly briefs for a private operating system. Be concrete, evidence-based, and action-oriented. Return JSON only.'
      },
      {
        role: 'user',
        content: JSON.stringify(llmPayload(input, computedStats, highlights))
      }
    ]
  });
  if (!result) return null;
  return {
    ...result,
    source: 'llm' as const,
    model: result.model || config.model,
    focusScore: clampScore(result.focusScore),
    wins: result.wins.slice(0, 6),
    risks: result.risks.slice(0, 6),
    nextActions: result.nextActions.slice(0, 8),
    questions: result.questions.slice(0, 6)
  };
}

export async function generateWeeklyBrief(options: { days?: number; withLlm?: boolean } = {}): Promise<WeeklyBrief> {
  const input = briefInput(options.days || 7);
  const computedStats = stats(input);
  const highlights = highlightItems(input);
  const synthesis = await maybeLlmSynthesis(input, computedStats, highlights, Boolean(options.withLlm))
    .catch(() => null)
    || localSynthesis(input, computedStats, highlights);
  return {
    generatedAt: input.generatedAt,
    range: input.range,
    synthesis,
    stats: computedStats,
    highlights,
    projectSignals: projectSignals(input),
    syncSignals: syncSignals(input)
  };
}
