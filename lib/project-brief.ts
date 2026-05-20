import type { Log, Project, ProjectWikiSnapshot, Task } from '@/lib/data';
import type { ProjectHealth } from '@/lib/project-health';

export type ProjectAutoBrief = {
  status: string;
  recentChanges: string[];
  biggestRisk: string;
  nextBestAction: string;
  verdict: {
    label: string;
    tone: 'green' | 'yellow' | 'red';
    reason: string;
  };
  signals: {
    progress: number;
    healthScore: number;
    openTasks: number;
    repoPushedAt?: string;
    wikiGeneratedAt?: string;
    source: string;
  };
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dayText(date?: string) {
  if (!date) return undefined;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return date;
  const days = Math.max(0, Math.round((Date.now() - parsed) / 86400000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 31) return `${days} 天前`;
  return date.slice(0, 10);
}

function statusLabel(status: Project['status']) {
  const labels: Record<Project['status'], string> = {
    idea: '仍在成形',
    building: '正在推进',
    paused: '暂停观察',
    shipped: '已经发布',
    archived: '已归档'
  };
  return labels[status];
}

function firstUseful(items: (string | undefined | false)[]) {
  return items.find(Boolean) || '信号不足。';
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function localStatus(project: Project, health: ProjectHealth, tasks: Task[]) {
  const doing = tasks.filter(task => task.status === 'doing');
  const waiting = tasks.filter(task => task.status === 'waiting');
  if (project.progress >= 80 || project.status === 'shipped') {
    return `${statusLabel(project.status)} / 高完成度。`;
  }
  if (waiting.length) {
    return `${statusLabel(project.status)} / ${waiting.length} waiting。`;
  }
  if (doing.length) {
    return `${statusLabel(project.status)} / ${doing.length} doing。`;
  }
  if (health.score < 46) {
    return `${statusLabel(project.status)} / 健康度低。`;
  }
  return `${statusLabel(project.status)} / ${project.progress}%。`;
}

function recentChanges(project: Project, wiki: ProjectWikiSnapshot | undefined, tasks: Task[], logs: Log[]) {
  const wikiChanges = wiki ? [
    wiki.repo.pushedAt ? `GitHub / ${dayText(wiki.repo.pushedAt)} / ${wiki.repo.owner}/${wiki.repo.name}` : undefined,
    `wiki / ${dayText(wiki.generatedAt) || wiki.generatedAt.slice(0, 10)} / ${wiki.fileTree.totalFiles} files`,
    wiki.frameworks.length ? `stack / ${wiki.frameworks.slice(0, 4).join(' / ')}` : undefined,
    wiki.codeInsights ? `code / ${wiki.codeInsights.architectureSummary}` : undefined
  ].filter(Boolean) as string[] : ['no wiki snapshot'];

  const taskChanges = tasks
    .slice()
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 2)
    .map(task => `task / ${task.status} / ${dayText(task.updated) || task.updated} / ${task.title}`);

  const logChanges = logs
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(log => `log / ${log.date} / ${log.title}`);

  return unique([...wikiChanges, ...taskChanges, ...logChanges]).slice(0, 5);
}

function biggestRisk(project: Project, wiki: ProjectWikiSnapshot | undefined, tasks: Task[], health: ProjectHealth) {
  const evaluation = project.progressEvaluation;
  if (evaluation?.source === 'ai' && evaluation.risks.length) return evaluation.risks[0];

  const highCodeRisk = wiki?.codeInsights?.risks.find(risk => risk.level === 'high') || wiki?.codeInsights?.risks[0];
  const waiting = tasks.filter(task => task.status === 'waiting');

  return firstUseful([
    highCodeRisk && `${highCodeRisk.title}：${highCodeRisk.detail}`,
    health.blockers[0],
    waiting.length ? `${waiting.length} waiting task(s)` : undefined,
    !wiki && 'no wiki snapshot',
    project.status === 'paused' && 'paused',
    'next step too fuzzy'
  ]);
}

function nextBestAction(project: Project, wiki: ProjectWikiSnapshot | undefined, tasks: Task[]) {
  const evaluation = project.progressEvaluation;
  if (evaluation?.source === 'ai' && evaluation.nextActions.length) return evaluation.nextActions[0];

  const doing = tasks.find(task => task.status === 'doing');
  const next = tasks.find(task => task.status === 'next');

  return firstUseful([
    doing && `finish / ${doing.title}`,
    next && `${next.priority} / ${next.title}`,
    wiki?.gaps[0] && `wiki gap / ${wiki.gaps[0]}`,
    project.nextActions[0],
    'one visible artifact'
  ]);
}

function verdict(project: Project, health: ProjectHealth, tasks: Task[]) {
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status)).length;
  const progress = clamp(project.progressEvaluation?.progress ?? project.progress);
  const signalScore = clamp(progress * 0.45 + health.score * 0.45 + Math.min(10, openTasks * 2));

  if (project.status === 'archived') {
    return { label: 'Park', tone: 'red' as const, reason: 'archived' };
  }
  if (project.status === 'paused' && health.score < 55) {
    return { label: 'Hold', tone: 'yellow' as const, reason: 'low signal' };
  }
  if (signalScore >= 68) {
    return { label: 'Push', tone: 'green' as const, reason: 'strong signal' };
  }
  if (signalScore >= 45) {
    return { label: 'Narrow', tone: 'yellow' as const, reason: 'make it smaller' };
  }
  return { label: 'Cool', tone: 'red' as const, reason: 'weak signal' };
}

export function generateProjectBrief(input: { project: Project; wikiSnapshot?: ProjectWikiSnapshot; tasks?: Task[]; logs?: Log[]; health: ProjectHealth }): ProjectAutoBrief {
  const { project, wikiSnapshot, tasks = [], logs = [], health } = input;
  const evaluation = project.progressEvaluation;
  const aiEvaluation = evaluation?.source === 'ai' ? evaluation : undefined;

  return {
    status: aiEvaluation ? aiEvaluation.summary : localStatus(project, health, tasks),
    recentChanges: recentChanges(project, wikiSnapshot, tasks, logs),
    biggestRisk: biggestRisk(project, wikiSnapshot, tasks, health),
    nextBestAction: nextBestAction(project, wikiSnapshot, tasks),
    verdict: verdict(project, health, tasks),
    signals: {
      progress: clamp(evaluation?.progress ?? project.progress),
      healthScore: health.score,
      openTasks: tasks.filter(task => !['done', 'archived'].includes(task.status)).length,
      repoPushedAt: wikiSnapshot?.repo.pushedAt,
      wikiGeneratedAt: wikiSnapshot?.generatedAt,
      source: aiEvaluation ? `AI / ${aiEvaluation.model}` : 'local signals'
    }
  };
}
