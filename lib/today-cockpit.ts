import { evaluateProjectHealth } from '@/lib/project-health';
import { sortProjectsByActivity } from '@/lib/project-activity';
import {
  getIdeas,
  getLogs,
  getProjects,
  getProjectWikis,
  getTasks,
  type Idea,
  type Log,
  type Project,
  type ProjectWikiSnapshot,
  type Task
} from '@/lib/data';

export type TodayCockpitProject = {
  slug: string;
  title: string;
  summary: string;
  status: Project['status'];
  priority: Project['priority'];
  updated: string;
  healthScore: number;
  healthLabel: string;
  reason: string;
  href: string;
};

export type TodayCockpitTask = {
  slug: string;
  title: string;
  summary: string;
  priority: Task['priority'];
  status: Task['status'];
  updated: string;
  href: string;
  projectTitle?: string;
};

export type TodayCockpit = {
  generatedAt: string;
  today: string;
  yesterday: string;
  mainLine: {
    title: string;
    action: string;
    reason: string;
    href: string;
    source: string;
  };
  yesterdayDone: {
    title: string;
    summary: string;
    count: number;
    href: string;
  };
  hotProjects: TodayCockpitProject[];
  coldProjects: TodayCockpitProject[];
  idea: {
    title: string;
    summary: string;
    next: string;
    score: number;
    href: string;
    linkedProject?: string;
  };
  notToday: {
    title: string;
    reason: string;
    href: string;
  };
  queue: TodayCockpitTask[];
  stats: {
    openTasks: number;
    doneYesterday: number;
    hotProjects: number;
    coldProjects: number;
    ideas: number;
  };
  logDraft: {
    title: string;
    date: string;
    tags: string[];
    content: string;
  };
};

const taskPriorityRank: Record<Task['priority'], number> = { P0: 0, P1: 1, P2: 2 };
const taskStatusRank: Record<Task['status'], number> = { doing: 0, next: 1, waiting: 2, done: 3, archived: 4 };
const ideaStatusRank: Record<Idea['status'], number> = { building: 0, validated: 1, spark: 2, killed: 3 };

function localIsoDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysSince(date?: string) {
  if (!date) return 999;
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed)) return 999;
  return Math.max(0, Math.floor((Date.now() - parsed) / 86400000));
}

function firstText(values: (string | undefined)[], fallback: string) {
  return values.map(value => value?.replace(/\s+/g, ' ').trim()).find(Boolean) || fallback;
}

function visibleProjectSummary(project: Project, isLoggedIn: boolean) {
  if (project.visibility === 'private' && !isLoggedIn) {
    return project.explanation || 'Private project. Public view shows only the operating shell.';
  }
  return project.progressEvaluation?.summary || project.summary;
}

function projectHref(project?: Project) {
  return project ? `/projects/${project.slug}` : '/tasks';
}

function projectTitle(project?: Project, isLoggedIn = true) {
  if (!project) return undefined;
  return project.visibility === 'private' && !isLoggedIn ? 'Private project' : project.title;
}

function doneSummary(tasks: Task[], logs: Log[], yesterday: string) {
  const doneTasks = tasks.filter(task => task.status === 'done' && task.updated.slice(0, 10) === yesterday);
  const yesterdayLogs = logs.filter(log => log.date.slice(0, 10) === yesterday);

  if (doneTasks.length) {
    return {
      title: doneTasks[0].title,
      summary: doneTasks.map(task => task.title).slice(0, 3).join(' / '),
      count: doneTasks.length,
      href: '/tasks'
    };
  }

  if (yesterdayLogs.length) {
    return {
      title: yesterdayLogs[0].title,
      summary: firstText([yesterdayLogs[0].content], 'Yesterday has a log entry.'),
      count: yesterdayLogs.length,
      href: '/log'
    };
  }

  const latestDone = tasks
    .filter(task => task.status === 'done')
    .sort((a, b) => b.updated.localeCompare(a.updated))[0];

  if (latestDone) {
    return {
      title: latestDone.title,
      summary: `No done item was captured yesterday; latest completed task was updated ${latestDone.updated}.`,
      count: 0,
      href: '/tasks'
    };
  }

  const latestLog = logs[0];
  return {
    title: latestLog ? latestLog.title : 'No explicit done record',
    summary: latestLog
      ? `No done item was captured yesterday; latest log is from ${latestLog.date}.`
      : 'No completion signal has been captured yet. End today with one concrete log.',
    count: 0,
    href: latestLog ? '/log' : '/tasks'
  };
}

function taskToCockpit(task: Task, projectBySlug: Map<string, Project>, isLoggedIn: boolean): TodayCockpitTask {
  const project = task.projectSlug ? projectBySlug.get(task.projectSlug) : undefined;
  return {
    slug: task.slug,
    title: task.title,
    summary: task.summary,
    priority: task.priority,
    status: task.status,
    updated: task.updated,
    href: projectHref(project),
    projectTitle: projectTitle(project, isLoggedIn)
  };
}

function projectToCockpit(input: { project: Project; wiki?: ProjectWikiSnapshot; tasks: Task[]; logs: Log[]; isLoggedIn: boolean }): TodayCockpitProject {
  const { project, wiki, tasks, logs, isLoggedIn } = input;
  const health = evaluateProjectHealth({ project, wiki, tasks, logs });
  const openTasks = tasks.filter(task => task.status !== 'done' && task.status !== 'archived');
  const age = daysSince(project.updated);
  const reason = firstText([
    openTasks[0] ? `${openTasks.length} open task(s); next is ${openTasks[0].title}.` : undefined,
    project.nextActions[0] ? `Next action: ${project.nextActions[0]}` : undefined,
    health.blockers[0],
    project.progressEvaluation?.summary
  ], `${project.status} project updated ${project.updated}.`);

  return {
    slug: project.slug,
    title: project.visibility === 'private' && !isLoggedIn ? 'Private project' : project.title,
    summary: visibleProjectSummary(project, isLoggedIn),
    status: project.status,
    priority: project.priority,
    updated: project.updated,
    healthScore: health.score,
    healthLabel: age >= 14 ? `${health.label} / ${age}d quiet` : health.label,
    reason,
    href: `/projects/${project.slug}`
  };
}

function selectMainLine(openTasks: Task[], projects: Project[], projectBySlug: Map<string, Project>, isLoggedIn: boolean) {
  const task = openTasks.find(item => item.priority === 'P0' && item.status !== 'waiting') || openTasks.find(item => item.status === 'doing') || openTasks[0];
  if (task) {
    const project = task.projectSlug ? projectBySlug.get(task.projectSlug) : undefined;
    return {
      title: task.title,
      action: task.summary,
      reason: `${task.priority} / ${task.status}${project ? ` / ${projectTitle(project, isLoggedIn)}` : ''}`,
      href: projectHref(project),
      source: task.sourceType
    };
  }

  const project = projects
    .filter(item => item.status === 'building' && item.nextActions.length)
    .sort((a, b) => (b.prioritySuggestion?.score || 0) - (a.prioritySuggestion?.score || 0) || b.updated.localeCompare(a.updated))[0];

  if (project) {
    return {
      title: project.nextActions[0],
      action: visibleProjectSummary(project, isLoggedIn),
      reason: `${project.priority} priority building project`,
      href: `/projects/${project.slug}`,
      source: projectTitle(project, isLoggedIn) || 'project'
    };
  }

  return {
    title: 'Capture one concrete next action',
    action: 'Pick one project, write the smallest visible next action, then stop expanding scope.',
    reason: 'No open task or active project action is available.',
    href: '/tasks',
    source: 'manual'
  };
}

function selectIdea(ideas: Idea[], projectBySlug: Map<string, Project>, isLoggedIn: boolean) {
  const idea = ideas
    .filter(item => item.status !== 'killed')
    .sort((a, b) => b.score - a.score || ideaStatusRank[a.status] - ideaStatusRank[b.status] || b.updated.localeCompare(a.updated))[0];
  const linkedProjectSlug = idea?.projectSlug || idea?.analysis?.suggestedProject;
  const project = linkedProjectSlug ? projectBySlug.get(linkedProjectSlug) : undefined;

  if (!idea) {
    return {
      title: 'No idea selected',
      summary: "The idea pool has no active idea. Capture one only after today's main line moves.",
      next: 'Keep the idea lane closed until execution has a fresh result.',
      score: 0,
      href: '/ideas',
      linkedProject: undefined
    };
  }

  return {
    title: idea.title,
    summary: idea.summary,
    next: idea.next || idea.analysis?.nextExperiment || 'Turn this into one small validation step.',
    score: idea.score,
    href: '/ideas',
    linkedProject: projectTitle(project, isLoggedIn)
  };
}

function selectNotToday(input: { openTasks: Task[]; coldProjects: TodayCockpitProject[]; ideas: Idea[]; projects: Project[] }) {
  const waiting = input.openTasks.find(task => task.status === 'waiting');
  if (waiting) {
    return {
      title: `Do not pull "${waiting.title}" into active work`,
      reason: 'It is marked waiting, so today should not spend execution energy pretending it is unblocked.',
      href: '/tasks'
    };
  }

  const cold = input.coldProjects[0];
  if (cold) {
    return {
      title: `Do not revive ${cold.title} today`,
      reason: `It is a cold lane (${cold.healthLabel}). Only touch it if the main line is done.`,
      href: cold.href
    };
  }

  const manyIdeas = input.ideas.filter(idea => idea.status !== 'killed').length > 1;
  if (manyIdeas) {
    return {
      title: 'Do not open a second idea thread',
      reason: 'The dashboard already picked one idea worth continuing; extra novelty would dilute the day.',
      href: '/ideas'
    };
  }

  return {
    title: 'Do not reorganize the cockpit',
    reason: 'Use the current dashboard as an operating surface; save meta-work for the evening log.',
    href: '/today'
  };
}

function buildLogDraft(input: Pick<TodayCockpit, 'today' | 'mainLine' | 'yesterdayDone' | 'hotProjects' | 'coldProjects' | 'idea' | 'notToday' | 'queue'>) {
  return {
    title: `${input.today} Daily Cockpit`,
    date: input.today,
    tags: ['daily', 'today', 'cockpit'],
    content: [
      `Main line: ${input.mainLine.title}`,
      `Action: ${input.mainLine.action}`,
      `Reason: ${input.mainLine.reason}`,
      '',
      `Yesterday done: ${input.yesterdayDone.title}`,
      input.yesterdayDone.summary,
      '',
      'Hot projects:',
      input.hotProjects.length ? input.hotProjects.map(project => `- ${project.title}: ${project.reason}`).join('\n') : '- none',
      '',
      'Cold projects:',
      input.coldProjects.length ? input.coldProjects.map(project => `- ${project.title}: ${project.healthLabel}`).join('\n') : '- none',
      '',
      `Idea worth continuing: ${input.idea.title}`,
      `Next: ${input.idea.next}`,
      '',
      `Not today: ${input.notToday.title}`,
      input.notToday.reason,
      '',
      'Execution queue:',
      input.queue.length ? input.queue.map(task => `- ${task.title} [${task.priority}/${task.status}]`).join('\n') : '- none'
    ].join('\n')
  };
}

export function generateTodayCockpit(input: { isLoggedIn?: boolean } = {}): TodayCockpit {
  const isLoggedIn = Boolean(input.isLoggedIn);
  const now = new Date();
  const today = localIsoDate(now);
  const yesterday = localIsoDate(addDays(now, -1));
  const projects = getProjects();
  const tasks = getTasks();
  const ideas = getIdeas();
  const logs = getLogs();
  const wikis = getProjectWikis();
  const projectBySlug = new Map(projects.map(project => [project.slug, project]));
  const wikiBySlug = new Map(wikis.map(wiki => [wiki.slug, wiki]));

  const tasksByProject = new Map<string, Task[]>();
  tasks.forEach(task => {
    if (!task.projectSlug) return;
    tasksByProject.set(task.projectSlug, [...(tasksByProject.get(task.projectSlug) || []), task]);
  });

  const logsByProject = new Map<string, Log[]>();
  logs.forEach(log => {
    log.tags.forEach(tag => {
      if (!projectBySlug.has(tag)) return;
      logsByProject.set(tag, [...(logsByProject.get(tag) || []), log]);
    });
  });

  const openTasks = tasks
    .filter(task => task.status !== 'done' && task.status !== 'archived')
    .sort((a, b) => taskPriorityRank[a.priority] - taskPriorityRank[b.priority] || taskStatusRank[a.status] - taskStatusRank[b.status] || b.updated.localeCompare(a.updated));

  const activitySignals = sortProjectsByActivity({ projects, wikis, tasks, logs });
  const activityScoreBySlug = new Map(activitySignals.map(signal => [signal.project.slug, signal.score]));
  const activityReasonBySlug = new Map(activitySignals.map(signal => [signal.project.slug, signal.reason]));

  const projectSignals = projects
    .filter(project => project.status !== 'archived')
    .map(project => {
      const signal = projectToCockpit({
      project,
      wiki: wikiBySlug.get(project.slug),
      tasks: tasksByProject.get(project.slug) || [],
      logs: logsByProject.get(project.slug) || [],
      isLoggedIn
    });
      const score = activityScoreBySlug.get(project.slug) || signal.healthScore;
      const reason = activityReasonBySlug.get(project.slug) || signal.reason;
      return { ...signal, healthScore: score, healthLabel: `heat ${score}`, reason };
    });

  const hotProjects = projectSignals
    .filter(project => project.status !== 'archived')
    .sort((a, b) => b.healthScore - a.healthScore || b.updated.localeCompare(a.updated))
    .slice(0, 3);

  const coldProjects = projectSignals
    .filter(project => project.status === 'paused' || project.healthScore < 52 || daysSince(project.updated) >= 14)
    .sort((a, b) => a.healthScore - b.healthScore || a.updated.localeCompare(b.updated))
    .slice(0, 3);

  const cockpitBase = {
    generatedAt: now.toISOString(),
    today,
    yesterday,
    mainLine: selectMainLine(openTasks, projects, projectBySlug, isLoggedIn),
    yesterdayDone: doneSummary(tasks, logs, yesterday),
    hotProjects,
    coldProjects,
    idea: selectIdea(ideas, projectBySlug, isLoggedIn),
    queue: openTasks.slice(0, 5).map(task => taskToCockpit(task, projectBySlug, isLoggedIn)),
    stats: {
      openTasks: openTasks.length,
      doneYesterday: tasks.filter(task => task.status === 'done' && task.updated.slice(0, 10) === yesterday).length,
      hotProjects: hotProjects.length,
      coldProjects: coldProjects.length,
      ideas: ideas.filter(idea => idea.status !== 'killed').length
    }
  };
  const notToday = selectNotToday({ openTasks, coldProjects, ideas, projects });
  const cockpit = { ...cockpitBase, notToday };

  return {
    ...cockpit,
    logDraft: buildLogDraft(cockpit)
  };
}
