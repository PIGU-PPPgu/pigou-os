import { spawnSync } from 'node:child_process';
import { appendOpsEvent, writeOpsJson } from '../lib/ops-store.mjs';

const fullIntervalSeconds = Number(process.env.PIGOU_WORKER_INTERVAL_SECONDS || '3600');
const jobIntervalSeconds = Number(process.env.PIGOU_JOB_INTERVAL_SECONDS || '300');

function run(label, command, args) {
  console.log(`[sync-worker] ${label}`);
  const startedAt = new Date().toISOString();
  writeHeartbeat({ state: 'running', currentTask: label, currentTaskStartedAt: startedAt });
  const result = spawnSync(command, args, { stdio: 'inherit' });
  const finishedAt = new Date().toISOString();
  if (result.error) {
    console.log(`[sync-worker] ${label} failed: ${result.error.message}`);
    appendOpsEvent({ type: 'worker-task-failed', label, error: result.error.message, startedAt, finishedAt });
  } else if (result.status !== 0) {
    console.log(`[sync-worker] ${label} exited with ${result.status}`);
    appendOpsEvent({ type: 'worker-task-failed', label, status: result.status, startedAt, finishedAt });
  } else {
    appendOpsEvent({ type: 'worker-task-success', label, startedAt, finishedAt });
  }
  writeHeartbeat({ state: 'idle', lastTask: label, lastTaskFinishedAt: finishedAt });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastFullSync = 0;

function writeHeartbeat(extra = {}) {
  writeOpsJson('worker-heartbeat', {
    generatedAt: new Date().toISOString(),
    pid: process.pid,
    fullIntervalSeconds,
    jobIntervalSeconds,
    lastFullSyncAt: lastFullSync ? new Date(lastFullSync).toISOString() : null,
    ...extra
  });
}

while (true) {
  const now = Date.now();
  writeHeartbeat({ state: 'idle' });
  if (!lastFullSync || now - lastFullSync >= fullIntervalSeconds * 1000) {
    run('sync contribution heatmap', 'node', ['scripts/sync-github-contributions.mjs']);
    run('sync github project drafts', 'node', ['scripts/sync-github-projects.mjs']);
    run('sync project wiki snapshots', 'node', ['scripts/sync-project-wikis.mjs']);
    run('refresh project status signals', 'node', ['scripts/refresh-project-signals.mjs']);
    run('rebuild llm wiki graph', 'node', ['scripts/rebuild-llm-wiki.mjs']);
    lastFullSync = Date.now();
    writeHeartbeat({ state: 'idle', lastFullSyncAt: new Date(lastFullSync).toISOString() });
  }

  run('process queued sync jobs', 'node', ['scripts/process-sync-jobs.mjs', '--limit=10']);
  await sleep(jobIntervalSeconds * 1000);
}
