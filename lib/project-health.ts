import type { Log, Project, ProjectWikiSnapshot, Task } from '@/lib/data';

export type ProjectHealth = {
  score: number;
  tone: 'green' | 'yellow' | 'red';
  label: string;
  dimensions: { key: string; label: string; score: number; reason: string }[];
  blockers: string[];
};

function daysSince(date?: string) {
  if (!date) return 999;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return 999;
  return Math.max(0, Math.round((Date.now() - parsed) / 86400000));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateProjectHealth(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[] }): ProjectHealth {
  const { project, wiki, tasks = [], logs = [] } = input;
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status));
  const waitingTasks = tasks.filter(task => task.status === 'waiting');
  const staleDays = Math.min(daysSince(wiki?.repo.pushedAt || project.updated), daysSince(project.updated));
  const evaluation = project.progressEvaluation;

  const product = clamp(evaluation?.progress ?? project.progress);
  const momentum = clamp(
    (staleDays <= 7 ? 42 : staleDays <= 30 ? 30 : staleDays <= 90 ? 14 : 4) +
    (openTasks.some(task => task.status === 'doing') ? 24 : 0) +
    Math.min(18, logs.length * 4) +
    Math.min(16, openTasks.length * 3)
  );
  const clarity = clamp(
    (project.summary ? 18 : 0) +
    (project.explanation ? 14 : 0) +
    Math.min(20, (project.readme?.length || 0) * 5) +
    (wiki?.readme?.summary?.length ? 16 : 0) +
    (wiki?.codeInsights ? 18 : 0) +
    (project.images?.some(image => image.public) ? 14 : 0)
  );
  const evidence = clamp(
    (project.status === 'shipped' ? 36 : project.status === 'building' ? 20 : 8) +
    (wiki ? 18 : 0) +
    Math.min(18, (project.images?.length || 0) * 5) +
    (evaluation?.confidence === 'high' ? 18 : evaluation?.confidence === 'medium' ? 10 : 4) +
    Math.min(10, logs.length * 2)
  );
  const riskPenalty = Math.min(42, (evaluation?.risks?.length || 0) * 7 + waitingTasks.length * 8 + (staleDays > 90 ? 12 : 0));
  const risk = clamp(100 - riskPenalty);
  const score = clamp(product * 0.32 + momentum * 0.2 + clarity * 0.2 + evidence * 0.18 + risk * 0.1);
  const tone = score >= 72 ? 'green' : score >= 46 ? 'yellow' : 'red';
  const label = tone === 'green' ? 'green' : tone === 'yellow' ? 'watch' : 'red';
  const blockers = [
    !wiki ? 'no wiki snapshot' : '',
    !wiki?.codeInsights ? 'no code insight' : '',
    !project.images?.some(image => image.public) ? 'no public media' : '',
    staleDays > 90 ? `${staleDays}d quiet` : '',
    waitingTasks.length ? `${waitingTasks.length} waiting` : ''
  ].filter(Boolean);

  return {
    score,
    tone,
    label,
    dimensions: [
      { key: 'product', label: 'product', score: product, reason: 'AI progress / project progress' },
      { key: 'momentum', label: 'momentum', score: momentum, reason: 'updates / doing / logs / open tasks' },
      { key: 'clarity', label: 'clarity', score: clarity, reason: 'README / media / wiki / code' },
      { key: 'evidence', label: 'evidence', score: evidence, reason: 'shipped / snapshot / media / confidence' },
      { key: 'risk', label: 'risk', score: risk, reason: 'waiting / stale / AI risks' }
    ],
    blockers
  };
}
