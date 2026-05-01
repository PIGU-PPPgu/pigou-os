import { spawnSync } from 'node:child_process';

const fullIntervalSeconds = Number(process.env.PIGOU_WORKER_INTERVAL_SECONDS || '3600');
const jobIntervalSeconds = Number(process.env.PIGOU_JOB_INTERVAL_SECONDS || '300');

function run(label, command, args) {
  console.log(`[sync-worker] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) console.log(`[sync-worker] ${label} failed: ${result.error.message}`);
  else if (result.status !== 0) console.log(`[sync-worker] ${label} exited with ${result.status}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastFullSync = 0;

while (true) {
  const now = Date.now();
  if (!lastFullSync || now - lastFullSync >= fullIntervalSeconds * 1000) {
    run('sync contribution heatmap', 'node', ['scripts/sync-github-contributions.mjs']);
    run('sync github project drafts', 'node', ['scripts/sync-github-projects.mjs']);
    run('sync project wiki snapshots', 'node', ['scripts/sync-project-wikis.mjs']);
    run('refresh project status signals', 'node', ['scripts/refresh-project-signals.mjs']);
    run('rebuild llm wiki graph', 'node', ['scripts/rebuild-llm-wiki.mjs']);
    lastFullSync = Date.now();
  }

  run('process queued sync jobs', 'node', ['scripts/process-sync-jobs.mjs', '--limit=10']);
  await sleep(jobIntervalSeconds * 1000);
}
