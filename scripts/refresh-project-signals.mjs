import { projectSlugs, refreshProjectSignals } from './project-sync-signals.mjs';

const only = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1];
const slugs = only ? [only] : projectSlugs();

let refreshed = 0;
let skipped = 0;

for (const slug of slugs) {
  const result = refreshProjectSignals(slug, { reason: 'manual-signal-refresh', skipLog: !only });
  if (!result.applied) {
    skipped += 1;
    console.log(`Skipped ${slug}: ${result.reason}`);
    continue;
  }
  refreshed += 1;
  console.log(`Refreshed ${slug}: ${result.evaluation.status} ${result.evaluation.progress}%${result.log ? ` (log ${result.log.slug})` : ''}`);
}

console.log(`Refreshed ${refreshed} project signal(s), skipped ${skipped}.`);
