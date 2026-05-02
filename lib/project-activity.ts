import type { Log, Project, ProjectWikiSnapshot, Task } from '@/lib/data';

export type ProjectActivitySignal = {
  project: Project;
  score: number;
  heat: 'hot' | 'warm' | 'cool';
  reason: string;
  evidence: string[];
  taskCount: number;
  recentLogCount: number;
  repoDays: number;
};

function daysSince(date?: string) {
  if (!date) return 999;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return 999;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function priorityRank(priority: Project['priority']) {
  return priority === 'high' ? 18 : priority === 'medium' ? 9 : 0;
}

function suggestedPriorityRank(project: Project) {
  const suggestion = project.prioritySuggestion;
  if (!suggestion) return 0;
  return suggestion.suggestedPriority === 'high' ? 22 : suggestion.suggestedPriority === 'medium' ? 10 : -4;
}

function statusRank(status: Project['status']) {
  if (status === 'building') return 16;
  if (status === 'shipped') return 8;
  if (status === 'idea') return 5;
  if (status === 'paused') return -10;
  return -28;
}

function momentumFromDays(days: number) {
  if (days <= 2) return 28;
  if (days <= 7) return 21;
  if (days <= 21) return 12;
  if (days <= 45) return 6;
  return 0;
}

function linkedTasks(project: Project, tasks: Task[]) {
  return tasks.filter(task => task.projectSlug === project.slug || task.sourceSlug === project.slug);
}

function linkedLogs(project: Project, logs: Log[]) {
  const slug = project.slug.toLowerCase();
  return logs.filter(log => log.tags.includes(project.slug) || log.content.toLowerCase().includes(slug));
}

export function evaluateProjectActivity(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[] }): ProjectActivitySignal {
  const { project, wiki, tasks = [], logs = [] } = input;
  const projectTasks = linkedTasks(project, tasks);
  const projectLogs = linkedLogs(project, logs);
  const openTasks = projectTasks.filter(task => task.status !== 'done' && task.status !== 'archived');
  const p0 = openTasks.filter(task => task.priority === 'P0').length;
  const p1 = openTasks.filter(task => task.priority === 'P1').length;
  const doing = openTasks.filter(task => task.status === 'doing').length;
  const recentLogCount = projectLogs.filter(log => daysSince(log.date) <= 14).length;
  const repoDays = daysSince(wiki?.repo.pushedAt || wiki?.generatedAt);
  const projectDays = daysSince(project.updated);
  const suggestionScore = project.prioritySuggestion?.score ?? 0;

  const taskScore = Math.min(34, p0 * 14 + p1 * 7 + doing * 12 + openTasks.length * 3);
  const score = clamp(
    8 +
    statusRank(project.status) +
    priorityRank(project.priority) +
    suggestedPriorityRank(project) +
    Math.round(suggestionScore * 0.16) +
    taskScore +
    momentumFromDays(Math.min(repoDays, projectDays)) +
    Math.min(14, recentLogCount * 7)
  );

  const evidence = [
    doing ? `${doing} doing` : '',
    p0 ? `${p0} P0` : '',
    p1 ? `${p1} P1` : '',
    project.prioritySuggestion ? `AI priority ${project.prioritySuggestion.suggestedPriority} / ${project.prioritySuggestion.score}` : '',
    repoDays < 999 ? `repo ${repoDays}d` : '',
    projectDays < 999 ? `updated ${projectDays}d` : '',
    recentLogCount ? `${recentLogCount} recent log` : ''
  ].filter(Boolean);
  const reason = evidence.slice(0, 3).join(' / ') || `${project.status} / ${project.priority}`;
  const heat = score >= 68 ? 'hot' : score >= 40 ? 'warm' : 'cool';

  return {
    project,
    score,
    heat,
    reason,
    evidence,
    taskCount: openTasks.length,
    recentLogCount,
    repoDays
  };
}

export function sortProjectsByActivity(input: { projects: Project[]; wikis?: ProjectWikiSnapshot[]; tasks?: Task[]; logs?: Log[] }) {
  const { projects, wikis = [], tasks = [], logs = [] } = input;
  const wikiBySlug = new Map(wikis.map(wiki => [wiki.slug, wiki]));
  return projects
    .map(project => evaluateProjectActivity({ project, wiki: wikiBySlug.get(project.slug), tasks, logs }))
    .sort((a, b) => b.score - a.score || b.project.updated.localeCompare(a.project.updated) || a.project.title.localeCompare(b.project.title));
}
