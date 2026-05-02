import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { refreshProjectSignals } from './project-sync-signals.mjs';
import { appendOpsEvent, writeOpsJson } from '../lib/ops-store.mjs';

loadEnvLocal();

const jobDir = path.join(process.cwd(), 'content', 'sync-jobs');
const projectDir = path.join(process.cwd(), 'content', 'projects');
const wikiDir = path.join(process.cwd(), 'content', 'project-wikis');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1];
const limit = Number(limitArg || '5');

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJob(job) {
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, `${job.id}.json`), `${JSON.stringify(job, null, 2)}\n`);
}

function recordJob(job, eventType) {
  const payload = {
    generatedAt: new Date().toISOString(),
    id: job.id,
    event: job.event,
    source: job.source,
    status: job.status,
    repo: job.repo,
    projectSlug: job.projectSlug,
    requestedAt: job.requestedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    attempts: job.attempts,
    summary: job.summary,
    error: job.error,
    artifacts: job.artifacts || []
  };
  writeOpsJson('last-sync-job', payload);
  appendOpsEvent({ type: eventType, jobId: job.id, status: job.status, repo: job.repo?.fullName, summary: job.summary, error: job.error });
}

function slugify(input) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

function findProjectSlug(job) {
  const preferred = job.projectSlug || slugify(job.repo.name);
  const preferredFile = path.join(projectDir, `${preferred}.json`);
  if (fs.existsSync(preferredFile)) return preferred;

  if (!fs.existsSync(projectDir)) return preferred;
  const projects = fs.readdirSync(projectDir)
    .filter(file => file.endsWith('.json'))
    .map(file => readJson(path.join(projectDir, file)));
  const match = projects.find(project => {
    const source = String(project.source || '').toLowerCase();
    const links = (project.links || []).map(link => String(link.url || '').toLowerCase()).join('\n');
    return source.includes(job.repo.fullName.toLowerCase()) || links.includes(job.repo.fullName.toLowerCase());
  });
  return match?.slug || preferred;
}

function run(command, args) {
  return execFileSync(command, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
}

async function warmDeepWiki(job) {
  if (job.warmDeepWiki === false || process.env.PIGOU_SYNC_WARM_DEEPWIKI === 'false') return { warmed: false, reason: 'disabled' };
  const base = (process.env.DEEPWIKI_OPEN_BASE_URL || 'http://localhost:8001').replace(/\/$/, '');
  const provider = process.env.DEEPWIKI_PROVIDER || 'openai';
  const model = process.env.DEEPWIKI_MODEL || process.env.OPENAI_MODEL || undefined;
  const repoUrl = job.repo.url || `https://github.com/${job.repo.fullName}`;
  const payload = {
    repo_url: repoUrl,
    type: 'github',
    provider,
    model,
    language: 'zh',
    messages: [
      {
        role: 'user',
        content: '请用 5 句话总结这个仓库的核心架构、入口文件、主要模块和潜在风险。'
      }
    ],
    ...(job.repo.private && process.env.DEEPWIKI_REPO_TOKEN ? { token: process.env.DEEPWIKI_REPO_TOKEN } : {})
  };

  try {
    const response = await fetch(`${base}/chat/completions/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { warmed: false, reason: `deepwiki-open HTTP ${response.status}: ${detail.slice(0, 240)}` };
    }
    const text = await response.text();
    return { warmed: true, chars: text.length };
  } catch (error) {
    return { warmed: false, reason: `deepwiki-open unavailable: ${error.message}` };
  }
}

async function processJob(file) {
  const job = readJson(file);
  if (!['queued', 'failed', 'needs-review'].includes(job.status)) return false;

  job.status = 'running';
  job.startedAt = new Date().toISOString();
  job.attempts = (job.attempts || 0) + 1;
  job.error = undefined;
  writeJob(job);
  recordJob(job, 'sync-job-started');

  try {
    if (job.event === 'rebuild-llm-wiki') {
      const output = run('node', ['scripts/rebuild-llm-wiki.mjs', `--scope=${job.scope || 'all'}`]);
      job.status = 'success';
      job.summary = output.trim().split('\n').slice(-1)[0] || 'LLM Wiki graph rebuilt.';
      job.artifacts = Array.from(new Set([...(job.artifacts || []), 'content/llm-wiki/current.json']));
      job.finishedAt = new Date().toISOString();
      writeJob(job);
      recordJob(job, 'sync-job-finished');
      console.log(`${job.status}: ${job.id} ${job.summary}`);
      return true;
    }

    const slug = findProjectSlug(job);
    job.projectSlug = slug;
    run('node', ['scripts/sync-github-projects.mjs']);

    const wikiArgs = ['scripts/sync-project-wikis.mjs', `--project=${slug}`];
    if (job.withLlm || process.env.PIGOU_SYNC_WITH_LLM === 'true') wikiArgs.push('--with-llm');
    const wikiOutput = run('node', wikiArgs);
    const wikiPath = path.join(wikiDir, `${slug}.json`);
    if (fs.existsSync(wikiPath)) job.artifacts = Array.from(new Set([...(job.artifacts || []), `content/project-wikis/${slug}.json`]));

    const warm = await warmDeepWiki(job);
    const projectSignals = refreshProjectSignals(slug, { job });
    if (projectSignals.applied) {
      job.artifacts = Array.from(new Set([
        ...(job.artifacts || []),
        `content/projects/${slug}.json`,
        ...(projectSignals.log ? [`content/log/${projectSignals.log.slug}.json`] : [])
      ]));
    }
    const graphOutput = run('node', ['scripts/rebuild-llm-wiki.mjs']).trim().split('\n').slice(-1)[0];
    job.status = warm.warmed || warm.reason === 'disabled' ? 'success' : 'needs-review';
    job.summary = [
      `Synced ${job.repo.fullName} as ${slug}.`,
      wikiOutput.trim().split('\n').slice(-1)[0],
      projectSignals.applied
        ? `project signals refreshed (${projectSignals.evaluation.status} ${projectSignals.evaluation.progress}%${projectSignals.log ? `, log ${projectSignals.log.slug}` : ''}).`
        : `project signals not refreshed: ${projectSignals.reason}.`,
      warm.warmed ? `deepwiki-open warmed (${warm.chars} chars).` : `deepwiki-open not warmed: ${warm.reason}`,
      graphOutput
    ].join(' ');
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    recordJob(job, 'sync-job-finished');
    console.log(`${job.status}: ${job.id} ${job.summary}`);
    return true;
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    writeJob(job);
    recordJob(job, 'sync-job-failed');
    console.log(`failed: ${job.id} ${error.message}`);
    return true;
  }
}

if (!fs.existsSync(jobDir)) {
  console.log('No sync jobs directory yet.');
  process.exit(0);
}

const files = fs.readdirSync(jobDir)
  .filter(file => file.endsWith('.json'))
  .map(file => path.join(jobDir, file))
  .filter(file => ['queued', 'failed', 'needs-review'].includes(readJson(file).status))
  .sort((a, b) => readJson(a).requestedAt.localeCompare(readJson(b).requestedAt))
  .slice(0, limit);

let processed = 0;
for (const file of files) {
  if (await processJob(file)) processed += 1;
}
console.log(`Processed ${processed} sync job(s).`);
