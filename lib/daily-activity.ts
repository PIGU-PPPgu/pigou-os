import {
  getContributionActivity,
  getGithubActivity,
  getKnowledge,
  getLogs,
  getProjects,
  getSyncJobs,
  getTasks,
  type GithubActivityEvent,
  type Project
} from '@/lib/data';

export type DailyActivityEvent = {
  id: string;
  type: 'commit' | 'sync' | 'task' | 'log' | 'knowledge' | 'contribution';
  title: string;
  meta: string;
  date: string;
  href: string;
  projectSlug?: string;
  private?: boolean;
};

export type DailyActivity = {
  generatedAt: string;
  today: string;
  yesterday: string;
  todayCount: number;
  yesterdayCount: number;
  last7Count: number;
  commitCount: number;
  syncCount: number;
  captureCount: number;
  streakDays: number;
  latest: DailyActivityEvent[];
  todayEvents: DailyActivityEvent[];
  yesterdayEvents: DailyActivityEvent[];
};

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function localDateFromIso(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return localDate(parsed);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function daysBetween(date: string, today: string) {
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const end = Date.parse(`${today}T00:00:00+08:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 999;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function projectTitle(project: Project | undefined, isLoggedIn: boolean) {
  if (!project) return undefined;
  if (project.visibility === 'private' && !isLoggedIn) return 'Private project';
  return project.title;
}

function commitEvent(event: GithubActivityEvent, project: Project | undefined, isLoggedIn: boolean): DailyActivityEvent {
  const isPrivate = Boolean(event.repo.private || project?.visibility === 'private');
  const title = isPrivate && !isLoggedIn ? 'Private repo commit' : event.message;
  return {
    id: `commit:${event.id}`,
    type: 'commit',
    title,
    meta: `${projectTitle(project, isLoggedIn) || event.repo.name} / ${event.sha.slice(0, 7)}`,
    date: localDateFromIso(event.authorDate),
    href: project ? `/projects/${project.slug}` : event.url,
    projectSlug: event.projectSlug,
    private: isPrivate
  };
}

function streak(days: { date: string; count: number }[], today: string) {
  const countByDate = new Map(days.map(day => [day.date, day.count]));
  let value = 0;
  let cursor = new Date(`${today}T00:00:00+08:00`);
  while (value < 366) {
    const key = localDate(cursor);
    if ((countByDate.get(key) || 0) <= 0) break;
    value += 1;
    cursor = addDays(cursor, -1);
  }
  return value;
}

export function buildDailyActivity(input: { isLoggedIn?: boolean } = {}): DailyActivity {
  const isLoggedIn = Boolean(input.isLoggedIn);
  const now = new Date();
  const today = localDate(now);
  const yesterday = localDate(addDays(now, -1));
  const projects = getProjects();
  const projectBySlug = new Map(projects.map(project => [project.slug, project]));
  const contribution = getContributionActivity();
  const githubFeed = getGithubActivity();

  const events: DailyActivityEvent[] = [];

  githubFeed.events.forEach(event => {
    events.push(commitEvent(event, event.projectSlug ? projectBySlug.get(event.projectSlug) : undefined, isLoggedIn));
  });

  getSyncJobs().forEach(job => {
    const date = localDateFromIso(job.finishedAt || job.startedAt || job.requestedAt);
    const project = job.projectSlug ? projectBySlug.get(job.projectSlug) : undefined;
    const isPrivate = Boolean(job.repo?.private || project?.visibility === 'private');
    events.push({
      id: `sync:${job.id}`,
      type: 'sync',
      title: isPrivate && !isLoggedIn ? 'Private repo synced' : job.summary || `${job.repo.fullName} synced`,
      meta: `${job.status} / ${projectTitle(project, isLoggedIn) || job.repo.name}`,
      date,
      href: project ? `/projects/${project.slug}` : '/ops',
      projectSlug: job.projectSlug,
      private: isPrivate
    });
  });

  getTasks()
    .filter(task => task.status === 'done')
    .forEach(task => {
      const project = task.projectSlug ? projectBySlug.get(task.projectSlug) : undefined;
      events.push({
        id: `task:${task.slug}`,
        type: 'task',
        title: task.title,
        meta: `${task.priority} / done${project ? ` / ${projectTitle(project, isLoggedIn)}` : ''}`,
        date: localDateFromIso(task.updated),
        href: project ? `/projects/${project.slug}` : '/tasks',
        projectSlug: task.projectSlug
      });
    });

  getLogs().forEach(log => {
    events.push({
      id: `log:${log.slug}`,
      type: 'log',
      title: log.title,
      meta: log.tags.slice(0, 3).join(' / ') || 'log',
      date: localDateFromIso(log.date),
      href: '/log'
    });
  });

  getKnowledge().forEach(note => {
    const project = note.relatedProjects?.[0] ? projectBySlug.get(note.relatedProjects[0]) : undefined;
    const isPrivate = Boolean(project?.visibility === 'private');
    events.push({
      id: `knowledge:${note.slug}`,
      type: 'knowledge',
      title: isPrivate && !isLoggedIn ? 'Private knowledge captured' : note.title,
      meta: `${note.platform || 'manual'} / ${note.status}`,
      date: localDateFromIso(note.capturedAt || note.updated),
      href: '/knowledge',
      projectSlug: note.relatedProjects?.[0],
      private: isPrivate
    });
  });

  contribution.days
    .filter(day => day.count > 0 && daysBetween(day.date, today) <= 6)
    .forEach(day => {
      events.push({
        id: `contribution:${day.date}`,
        type: 'contribution',
        title: `${day.count} GitHub contribution${day.count > 1 ? 's' : ''}`,
        meta: contribution.owner,
        date: day.date,
        href: '/overview'
      });
    });

  const visibleEvents = isLoggedIn ? events : events.filter(event => !event.private);
  const unique = Array.from(new Map(visibleEvents.map(event => [event.id, event])).values())
    .filter(event => event.date)
    .sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
  const todayEvents = unique.filter(event => event.date === today);
  const yesterdayEvents = unique.filter(event => event.date === yesterday);
  const last7Events = unique.filter(event => daysBetween(event.date, today) <= 6);

  return {
    generatedAt: now.toISOString(),
    today,
    yesterday,
    todayCount: todayEvents.length,
    yesterdayCount: yesterdayEvents.length,
    last7Count: last7Events.length,
    commitCount: last7Events.filter(event => event.type === 'commit').length,
    syncCount: last7Events.filter(event => event.type === 'sync').length,
    captureCount: last7Events.filter(event => event.type === 'knowledge').length,
    streakDays: streak(contribution.days, today),
    latest: unique.slice(0, 12),
    todayEvents: todayEvents.slice(0, 8),
    yesterdayEvents: yesterdayEvents.slice(0, 8)
  };
}
