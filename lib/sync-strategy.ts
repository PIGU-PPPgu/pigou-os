import { getIdeas, getKnowledge, getProjectWikis, getProjects, getSyncJobs, getTasks, type SyncJob } from '@/lib/data';

export type SyncStrategyNode = {
  id: string;
  label: string;
  kind: 'source' | 'processor' | 'store' | 'review';
  count: number;
  status: 'healthy' | 'watch' | 'blocked';
  detail: string;
};

export type SyncStrategyFlow = {
  from: string;
  to: string;
  label: string;
  mode: 'pull' | 'derive' | 'write' | 'review';
};

export type SyncStrategy = {
  generatedAt: string;
  headline: string;
  nodes: SyncStrategyNode[];
  flows: SyncStrategyFlow[];
  cadences: { label: string; value: string; detail: string }[];
  safeguards: string[];
};

function statusForJobs(jobs: SyncJob[]): SyncStrategyNode['status'] {
  if (jobs.some(job => job.status === 'failed')) return 'blocked';
  if (jobs.some(job => job.status === 'needs-review' || job.status === 'queued' || job.status === 'running')) return 'watch';
  return 'healthy';
}

export function buildSyncStrategy(): SyncStrategy {
  const projects = getProjects();
  const tasks = getTasks();
  const knowledge = getKnowledge();
  const ideas = getIdeas();
  const wikis = getProjectWikis();
  const jobs = getSyncJobs();
  const reviewJobs = jobs.filter(job => job.status === 'failed' || job.status === 'needs-review');
  const activeJobs = jobs.filter(job => job.status === 'queued' || job.status === 'running');
  const evaluatedProjects = projects.filter(project => project.progressEvaluation);
  const linkedKnowledge = knowledge.filter(note => note.status === 'linked');
  const projectJsonStatus = reviewJobs.length ? 'watch' : 'healthy';

  return {
    generatedAt: new Date().toISOString(),
    headline: reviewJobs.length
      ? `${reviewJobs.length} sync job(s) need review before project JSON should be trusted as fresh.`
      : 'Project JSON remains the source of truth, refreshed by GitHub, wiki, knowledge, tasks, and progress evaluation.',
    nodes: [
      {
        id: 'github',
        label: 'GitHub',
        kind: 'source',
        count: new Set(jobs.map(job => job.repo.fullName)).size,
        status: statusForJobs(jobs),
        detail: activeJobs.length ? `${activeJobs.length} job(s) queued or running` : `${jobs.length} recorded job(s)`
      },
      {
        id: 'wiki',
        label: 'Project Wiki',
        kind: 'processor',
        count: wikis.length,
        status: wikis.length ? 'healthy' : 'watch',
        detail: 'Repository snapshots and code insights'
      },
      {
        id: 'progress',
        label: 'Progress Eval',
        kind: 'processor',
        count: evaluatedProjects.length,
        status: evaluatedProjects.length ? 'healthy' : 'watch',
        detail: 'AI or algorithmic project status suggestions'
      },
      {
        id: 'knowledge',
        label: 'Knowledge',
        kind: 'source',
        count: knowledge.length,
        status: linkedKnowledge.length === knowledge.length && knowledge.length ? 'healthy' : 'watch',
        detail: `${linkedKnowledge.length}/${knowledge.length} linked note(s)`
      },
      {
        id: 'ideas',
        label: 'Ideas',
        kind: 'source',
        count: ideas.length,
        status: ideas.some(idea => idea.score >= 75) ? 'healthy' : 'watch',
        detail: `${ideas.filter(idea => idea.score >= 75).length} high-signal idea(s)`
      },
      {
        id: 'tasks',
        label: 'Tasks',
        kind: 'review',
        count: tasks.length,
        status: tasks.some(task => task.priority === 'P0' && task.status !== 'done') ? 'watch' : 'healthy',
        detail: `${tasks.filter(task => task.status !== 'done' && task.status !== 'archived').length} open task(s)`
      },
      {
        id: 'project-json',
        label: 'Project JSON',
        kind: 'store',
        count: projects.length,
        status: projectJsonStatus,
        detail: 'Durable local content registry'
      }
    ],
    flows: [
      { from: 'github', to: 'wiki', label: 'repo snapshots', mode: 'pull' },
      { from: 'wiki', to: 'progress', label: 'code evidence', mode: 'derive' },
      { from: 'knowledge', to: 'progress', label: 'usage signals', mode: 'derive' },
      { from: 'ideas', to: 'tasks', label: 'experiments', mode: 'review' },
      { from: 'tasks', to: 'progress', label: 'execution state', mode: 'derive' },
      { from: 'progress', to: 'project-json', label: 'approved status writes', mode: 'write' },
      { from: 'knowledge', to: 'project-json', label: 'manual links', mode: 'write' }
    ],
    cadences: [
      { label: 'GitHub sync', value: activeJobs.length ? 'active' : 'on demand', detail: 'Webhook, manual queue, or cron job creates sync jobs.' },
      { label: 'Wiki refresh', value: `${wikis.length} snapshots`, detail: 'Repository facts are kept separate from project summaries.' },
      { label: 'Progress eval', value: `${evaluatedProjects.length}/${projects.length}`, detail: 'Suggestions write back only after owner approval.' },
      { label: 'Knowledge links', value: `${linkedKnowledge.length}/${knowledge.length}`, detail: 'Notes and ideas supply qualitative evidence.' }
    ],
    safeguards: [
      'Project JSON is the final local source of truth.',
      'Sync jobs collect facts; progress evaluation proposes changes.',
      'Failed or needs-review jobs should block blind trust in fresh status.',
      'Private page and weekly API require login before internal data is exposed.'
    ]
  };
}
