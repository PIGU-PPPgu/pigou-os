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
  return items.find(Boolean) || '暂无足够信号，需要补充任务、日志或 wiki 快照。';
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function localStatus(project: Project, health: ProjectHealth, tasks: Task[]) {
  const doing = tasks.filter(task => task.status === 'doing');
  const waiting = tasks.filter(task => task.status === 'waiting');
  if (project.progress >= 80 || project.status === 'shipped') {
    return `${statusLabel(project.status)}，已经有较高完成度，重点应放在发布质量、证据沉淀和后续维护。`;
  }
  if (waiting.length) {
    return `${statusLabel(project.status)}，但有 ${waiting.length} 个任务卡在 waiting，推进节奏需要重新排障。`;
  }
  if (doing.length) {
    return `${statusLabel(project.status)}，当前有 ${doing.length} 个 doing 任务，适合继续收敛到可验证交付。`;
  }
  if (health.score < 46) {
    return `${statusLabel(project.status)}，健康度偏低，当前更像一个需要重新澄清边界的项目。`;
  }
  return `${statusLabel(project.status)}，进度 ${project.progress}%，目前可以继续用小步验证来推进。`;
}

function recentChanges(project: Project, wiki: ProjectWikiSnapshot | undefined, tasks: Task[], logs: Log[]) {
  const wikiChanges = wiki ? [
    wiki.repo.pushedAt ? `GitHub 最近推送在 ${dayText(wiki.repo.pushedAt)}，仓库 ${wiki.repo.owner}/${wiki.repo.name} 已进入项目页信号。` : undefined,
    `wiki 快照生成于 ${dayText(wiki.generatedAt) || wiki.generatedAt.slice(0, 10)}，覆盖 ${wiki.fileTree.totalFiles} 个文件。`,
    wiki.frameworks.length ? `检测到技术栈：${wiki.frameworks.slice(0, 4).join(' / ')}。` : undefined,
    wiki.codeInsights ? `源码洞察已更新：${wiki.codeInsights.architectureSummary}` : undefined
  ].filter(Boolean) as string[] : ['还没有 GitHub/wiki 快照，最近变化只能从项目卡片、任务和日志推断。'];

  const taskChanges = tasks
    .slice()
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 2)
    .map(task => `任务更新：${task.title}（${task.status}，${dayText(task.updated) || task.updated}）。`);

  const logChanges = logs
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)
    .map(log => `日志记录：${log.title}（${log.date}）。`);

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
    waiting.length ? `${waiting.length} 个任务处于 waiting，说明当前执行链路存在阻塞。` : undefined,
    !wiki && '缺少 GitHub/wiki 快照，无法判断代码真实状态和最近变化。',
    project.status === 'paused' && '项目已暂停，风险是继续占用注意力但没有明确恢复条件。',
    '最大风险不是技术本身，而是下一步验证动作还不够具体。'
  ]);
}

function nextBestAction(project: Project, wiki: ProjectWikiSnapshot | undefined, tasks: Task[]) {
  const evaluation = project.progressEvaluation;
  if (evaluation?.source === 'ai' && evaluation.nextActions.length) return evaluation.nextActions[0];

  const doing = tasks.find(task => task.status === 'doing');
  const next = tasks.find(task => task.status === 'next');

  return firstUseful([
    doing && `先收尾 doing 任务：${doing.title}。`,
    next && `启动下一个 P${next.priority.replace('P', '')} 任务：${next.title}。`,
    wiki?.gaps[0] && `补齐 wiki 缺口：${wiki.gaps[0]}`,
    project.nextActions[0],
    '定义一个 30 分钟内能完成的最小验证动作，并写入任务队列。'
  ]);
}

function verdict(project: Project, health: ProjectHealth, tasks: Task[]) {
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status)).length;
  const progress = clamp(project.progressEvaluation?.progress ?? project.progress);
  const signalScore = clamp(progress * 0.45 + health.score * 0.45 + Math.min(10, openTasks * 2));

  if (project.status === 'archived') {
    return { label: '不建议继续投入', tone: 'red' as const, reason: '项目已归档，除非有新的外部证据，否则不应重新占用主线注意力。' };
  }
  if (project.status === 'paused' && health.score < 55) {
    return { label: '先暂停，补证据', tone: 'yellow' as const, reason: '当前健康度和推进信号不足，应该先明确恢复条件。' };
  }
  if (signalScore >= 68) {
    return { label: '值得继续推进', tone: 'green' as const, reason: '进度、健康度和执行队列合在一起，说明它仍然有继续产出的机会。' };
  }
  if (signalScore >= 45) {
    return { label: '谨慎推进', tone: 'yellow' as const, reason: '项目还有价值，但下一步必须更小、更可验证，避免继续发散。' };
  }
  return { label: '暂缓投入', tone: 'red' as const, reason: '当前缺少足够的进展、证据或健康度支撑。' };
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
      source: aiEvaluation ? `引用已有 AI 评估：${aiEvaluation.model}` : '本地 deterministic signals'
    }
  };
}
