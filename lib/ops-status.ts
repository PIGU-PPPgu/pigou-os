import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { SyncJob } from '@/lib/data';
import { getLlmWikiGraph, getSyncJobs } from '@/lib/data';

export type OpsTone = 'ok' | 'warn' | 'bad' | 'idle';

export type OpsStatusItem = {
  label: string;
  value: string;
  detail?: string;
  at?: string;
  ageMinutes?: number;
  tone: OpsTone;
};

export type OpsRecentError = {
  source: string;
  message: string;
  at?: string;
  detail?: string;
};

export type OpsStatusSnapshot = {
  generatedAt: string;
  deploy: {
    commit: string;
    branch?: string;
    deployedAt?: string;
    source: string;
    status?: string;
    previousCommit?: string;
    error?: string;
  };
  worker: OpsStatusItem;
  lastSyncJob: OpsStatusItem & { job?: Pick<SyncJob, 'id' | 'status' | 'repo' | 'event' | 'summary' | 'error' | 'requestedAt' | 'finishedAt'> };
  lastLlmWikiRebuild: OpsStatusItem;
  lastContentWrite: OpsStatusItem & { path?: string };
  recentErrors: OpsRecentError[];
  counters: {
    syncJobs: number;
    pendingJobs: number;
    reviewJobs: number;
    recentErrors: number;
  };
};

type OpsDeployFile = {
  generatedAt?: string;
  status?: string;
  startedAt?: string;
  finishedAt?: string;
  branch?: string;
  before?: string;
  after?: string;
  error?: string;
};

type OpsHeartbeatFile = {
  generatedAt?: string;
  checkedAt?: string;
  heartbeatAt?: string;
  updatedAt?: string;
  state?: string;
  status?: string;
  summary?: string;
  error?: string;
  currentTask?: string;
  lastTask?: string;
  lastTaskFinishedAt?: string;
  lastFullSyncAt?: string | null;
};

type FileStat = { file: string; relativePath: string; mtimeMs: number; mtime: string };

const minute = 60 * 1000;
const workerOkMinutes = Number(process.env.PIGOU_WORKER_OK_MINUTES || '20');
const workerWarnMinutes = Number(process.env.PIGOU_WORKER_WARN_MINUTES || '90');

function ageMinutes(value?: string, now = Date.now()) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.round((now - parsed) / minute));
}

function toneForAge(age: number | undefined, okMinutes: number, warnMinutes: number): OpsTone {
  if (age === undefined) return 'idle';
  if (age <= okMinutes) return 'ok';
  if (age <= warnMinutes) return 'warn';
  return 'bad';
}

function safeExec(args: string[]) {
  try {
    return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function deployInfo() {
  const deployFile = readOpsJson<OpsDeployFile>('deploy');
  const commit =
    deployFile?.after ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NETLIFY_COMMIT_REF ||
    process.env.GITHUB_SHA ||
    safeExec(['rev-parse', '--short=12', 'HEAD']) ||
    'unknown';
  const branch =
    deployFile?.branch ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.BRANCH ||
    process.env.GITHUB_REF_NAME ||
    safeExec(['rev-parse', '--abbrev-ref', 'HEAD']) ||
    undefined;
  const deployedAt =
    deployFile?.finishedAt ||
    deployFile?.generatedAt ||
    process.env.PIGOU_DEPLOYED_AT ||
    process.env.DEPLOY_TIME ||
    process.env.NEXT_PUBLIC_DEPLOY_TIME ||
    latestBuildMarker();

  return {
    commit: commit.length > 12 ? commit.slice(0, 12) : commit,
    branch,
    deployedAt,
    source: deployFile ? 'production host' : process.env.VERCEL ? 'vercel' : process.env.NETLIFY ? 'netlify' : deployedAt ? 'runtime' : 'git',
    status: deployFile?.status,
    previousCommit: deployFile?.before,
    error: deployFile?.error
  };
}

function readOpsJson<T>(name: string): T | null {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), 'content', 'ops', `${name}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function latestBuildMarker() {
  const candidates = ['.next/BUILD_ID', '.next/server/app-paths-manifest.json', 'package.json'];
  const stats = candidates
    .map(file => fileStat(path.join(/*turbopackIgnore: true*/ process.cwd(), file)))
    .filter((item): item is FileStat => Boolean(item))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return stats[0]?.mtime;
}

function fileStat(file: string): FileStat | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return null;
    return {
      file,
      relativePath: path.relative(/*turbopackIgnore: true*/ process.cwd(), file),
      mtimeMs: stat.mtimeMs,
      mtime: stat.mtime.toISOString()
    };
  } catch {
    return null;
  }
}

function latestContentWrite() {
  const contentDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'content');
  const files: FileStat[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.jsonl'))) {
        const stat = fileStat(full);
        if (stat) files.push(stat);
      }
    }
  }
  walk(contentDir);
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
}

function readHeartbeat() {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'content', 'ops', 'worker-heartbeat.json'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'content', 'ops', 'heartbeat.json')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as OpsHeartbeatFile;
      const at = raw.heartbeatAt || raw.checkedAt || raw.updatedAt || raw.generatedAt || raw.lastTaskFinishedAt || raw.lastFullSyncAt || undefined;
      if (!at) continue;
      const summary = raw.summary || raw.currentTask || raw.lastTask || raw.state || raw.status;
      return { at, status: raw.status || raw.state, summary, error: raw.error, path: path.relative(/*turbopackIgnore: true*/ process.cwd(), file) };
    } catch {
      return null;
    }
  }
  return null;
}

function latestWorkerActivity(jobs: SyncJob[], contentWrite?: FileStat) {
  const heartbeat = readHeartbeat();
  if (heartbeat) return { at: heartbeat.at, source: heartbeat.path, detail: heartbeat.error || heartbeat.summary || heartbeat.status || 'heartbeat file' };

  const workerJob = jobs.find(job => job.startedAt || job.finishedAt || job.status === 'running');
  if (workerJob) {
    return {
      at: workerJob.finishedAt || workerJob.startedAt || workerJob.requestedAt,
      source: `sync job / ${workerJob.repo.fullName}`,
      detail: workerJob.summary || workerJob.error || workerJob.event || workerJob.status
    };
  }

  if (contentWrite) return { at: contentWrite.mtime, source: contentWrite.relativePath, detail: 'latest content write' };
  return null;
}

function statusTime(job?: SyncJob) {
  return job?.finishedAt || job?.startedAt || job?.requestedAt;
}

function jobTone(status?: SyncJob['status']): OpsTone {
  if (!status) return 'idle';
  if (status === 'success') return 'ok';
  if (status === 'queued' || status === 'running') return 'warn';
  return 'bad';
}

function recentErrors(jobs: SyncJob[]) {
  return jobs
    .filter(job => job.status === 'failed' || job.status === 'needs-review' || job.error)
    .slice(0, 8)
    .map(job => ({
      source: `${job.repo.fullName} / ${job.event || job.source}`,
      message: job.error || job.summary || `Job is ${job.status}`,
      at: statusTime(job),
      detail: job.id
    }));
}

export function getOpsStatusSnapshot(): OpsStatusSnapshot {
  const generatedAt = new Date().toISOString();
  const now = Date.parse(generatedAt);
  const jobs = getSyncJobs();
  const latestJob = jobs[0];
  const latestWrite = latestContentWrite();
  const workerActivity = latestWorkerActivity(jobs, latestWrite);
  const workerAge = ageMinutes(workerActivity?.at, now);
  const graph = getLlmWikiGraph();
  const graphAge = ageMinutes(graph?.generatedAt, now);
  const writeAge = ageMinutes(latestWrite?.mtime, now);
  const errors = recentErrors(jobs);

  return {
    generatedAt,
    deploy: deployInfo(),
    worker: {
      label: 'Worker heartbeat',
      value: workerActivity ? (workerAge !== undefined ? `${workerAge}m ago` : 'observed') : 'no signal',
      detail: workerActivity ? `${workerActivity.source} · ${workerActivity.detail}` : 'No heartbeat, sync job, or content write has been observed.',
      at: workerActivity?.at,
      ageMinutes: workerAge,
      tone: toneForAge(workerAge, workerOkMinutes, workerWarnMinutes)
    },
    lastSyncJob: {
      label: 'Last sync job',
      value: latestJob ? latestJob.status : 'none',
      detail: latestJob ? `${latestJob.repo.fullName} · ${latestJob.summary || latestJob.error || latestJob.event || latestJob.source}` : 'No sync job files found.',
      at: statusTime(latestJob),
      ageMinutes: ageMinutes(statusTime(latestJob), now),
      tone: jobTone(latestJob?.status),
      job: latestJob ? {
        id: latestJob.id,
        status: latestJob.status,
        repo: latestJob.repo,
        event: latestJob.event,
        summary: latestJob.summary,
        error: latestJob.error,
        requestedAt: latestJob.requestedAt,
        finishedAt: latestJob.finishedAt
      } : undefined
    },
    lastLlmWikiRebuild: {
      label: 'Last LLM Wiki rebuild',
      value: graph ? `${graph.nodes.length} nodes` : 'missing',
      detail: graph ? `${graph.edges.length} edges · scope ${graph.scope}` : 'content/llm-wiki/current.json not found.',
      at: graph?.generatedAt,
      ageMinutes: graphAge,
      tone: toneForAge(graphAge, 24 * 60, 7 * 24 * 60)
    },
    lastContentWrite: {
      label: 'Last content write',
      value: latestWrite ? latestWrite.relativePath.replace(/^content\//, '') : 'none',
      detail: latestWrite ? 'mtime from local JSON content source' : 'No content JSON files found.',
      at: latestWrite?.mtime,
      ageMinutes: writeAge,
      tone: toneForAge(writeAge, 24 * 60, 7 * 24 * 60),
      path: latestWrite?.relativePath
    },
    recentErrors: errors,
    counters: {
      syncJobs: jobs.length,
      pendingJobs: jobs.filter(job => job.status === 'queued' || job.status === 'running').length,
      reviewJobs: jobs.filter(job => job.status === 'failed' || job.status === 'needs-review').length,
      recentErrors: errors.length
    }
  };
}
