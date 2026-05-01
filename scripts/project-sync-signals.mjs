import fs from 'node:fs';
import path from 'node:path';

const projectDir = path.join(process.cwd(), 'content', 'projects');
const wikiDir = path.join(process.cwd(), 'content', 'project-wikis');
const taskDir = path.join(process.cwd(), 'content', 'tasks');
const logDir = path.join(process.cwd(), 'content', 'log');

export function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function slugify(input) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function daysSince(date) {
  if (!date) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - parsed) / 86400000));
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniq(items) {
  return Array.from(new Set(items.map(item => String(item || '').trim()).filter(Boolean)));
}

function readJsonDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.json'))
    .map(file => readJson(path.join(dirPath, file)));
}

function projectCorpus(project, wiki) {
  return [
    project.title,
    project.summary,
    project.explanation,
    ...(project.readme || []),
    wiki?.readme?.title,
    ...(wiki?.readme?.summary || [])
  ].filter(Boolean).join('\n').toLowerCase();
}

function statusFromSignals(project, corpus, wiki) {
  if (project.status === 'archived') return 'archived';
  if (project.status === 'shipped') return 'shipped';
  if (/已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus)) return 'shipped';
  if (wiki && daysSince(wiki.repo?.pushedAt || wiki.generatedAt) > 150) return 'paused';
  if (wiki && wiki.fileTree?.totalFiles > 20) return 'building';
  return project.status === 'paused' ? 'paused' : 'idea';
}

function progressFromSignals(project, corpus, wiki, tasks, logs) {
  if (/已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus)) return Math.max(project.progress, 88);

  let score = project.status === 'idea' ? 18 : project.status === 'paused' ? 35 : project.status === 'building' ? 48 : project.progress;
  if (wiki) {
    const totalFiles = wiki.fileTree?.totalFiles || 0;
    if (totalFiles > 0) score += 8;
    if (totalFiles > 50) score += 8;
    if (totalFiles > 300) score += 8;
    if (totalFiles > 1000) score += 5;
    if (wiki.readme?.summary?.length) score += 6;
    if (wiki.frameworks?.length) score += 5;
    if (wiki.entrypoints?.length) score += 4;
    if (wiki.codeInsights) score += 6;
    if ((wiki.gaps || []).some(gap => /package\.json|README|file tree/i.test(gap))) score -= 4;
    if (daysSince(wiki.repo?.pushedAt || wiki.generatedAt) <= 30) score += 5;
  }
  if (project.images?.length) score += 6;
  if (logs.length) score += Math.min(6, logs.length * 2);
  if (tasks.some(task => task.status === 'done')) score += 4;
  if (tasks.some(task => task.status === 'doing')) score += 3;
  if (tasks.some(task => task.status === 'waiting')) score -= 3;
  return clampProgress(Math.max(project.progress - 8, Math.min(project.progress + 18, score)));
}

function nextActionsFromSignals(project, wiki, tasks) {
  const openTasks = tasks.filter(task => !['done', 'archived'].includes(task.status)).slice(0, 2).map(task => task.title);
  const actions = [...openTasks];
  if (!wiki) actions.push('Run GitHub/wiki sync to create a code understanding snapshot.');
  if (wiki && !wiki.codeInsights) actions.push('Generate LLM code insights for the most important source files.');
  if (wiki?.gaps?.some(gap => /package\.json/i.test(gap))) actions.push('Clarify runtime stack and entrypoint because package metadata is missing.');
  if (!project.images?.some(image => image.public)) actions.push('Add one approved public screenshot or product surface image.');
  actions.push(...(project.nextActions || []).slice(0, 2).map(String));
  return uniq(actions).slice(0, 4);
}

function evaluateProjectSignals(project, wiki, tasks, logs) {
  const corpus = projectCorpus(project, wiki);
  const status = statusFromSignals(project, corpus, wiki);
  const progress = progressFromSignals(project, corpus, wiki, tasks, logs);
  const nextActions = nextActionsFromSignals(project, wiki, tasks);
  const totalFiles = wiki?.fileTree?.totalFiles || 0;
  const technical = clampProgress(totalFiles > 300 ? 20 : totalFiles > 50 ? 16 : totalFiles > 0 ? 10 : 2);
  const product = clampProgress(status === 'shipped' ? 25 : status === 'building' ? 16 : status === 'paused' ? 10 : 5);
  const usage = /已投入正常使用|投入正常使用|上线|已发布|shipped|launched|production/.test(corpus) || status === 'shipped' ? 25 : project.images?.length ? 10 : 4;
  const documentation = clampProgress((project.readme?.length ? 5 : 0) + (wiki?.readme?.summary?.length ? 6 : 0) + (wiki?.codeInsights ? 4 : 0));
  const momentum = clampProgress((wiki && daysSince(wiki.repo?.pushedAt || wiki.generatedAt) <= 30 ? 8 : 2) + (logs.length ? Math.min(4, logs.length) : 0) + (tasks.some(task => task.status === 'doing') ? 3 : 0));

  return {
    generatedAt: localDate(),
    model: 'sync-worker-signal-engine',
    source: 'algorithm',
    progress,
    status,
    confidence: wiki && (tasks.length || logs.length || wiki.readme?.summary?.length) ? 'medium' : 'low',
    summary: 'GitHub sync processed; Pigou OS refreshed the project wiki, progress, status, and sync log signals from repository evidence.',
    rationale: 'The sync pipeline applied local repository, wiki, task, image, and log signals after refreshing GitHub data.',
    dimensions: [
      { name: 'product_readiness', score: product, max: 25, reason: 'Project status, launch wording, and product surface signals.' },
      { name: 'technical_completeness', score: technical, max: 20, reason: 'Repository file count, framework, entrypoint, module, and code insight signals.' },
      { name: 'usage_validation', score: usage, max: 25, reason: 'Launch/use wording, screenshots, and visible product proof.' },
      { name: 'documentation_knowledge', score: documentation, max: 15, reason: 'Project notes, README summary, and wiki/code insight completeness.' },
      { name: 'momentum', score: momentum, max: 15, reason: 'Recent push, linked work items, and project log activity.' }
    ],
    evidence: [
      wiki ? `repo files: ${totalFiles}` : 'no GitHub/wiki snapshot',
      wiki?.repo?.pushedAt ? `last push: ${wiki.repo.pushedAt.slice(0, 10)}` : '',
      wiki?.frameworks?.length ? `frameworks: ${wiki.frameworks.join(', ')}` : '',
      project.images?.length ? `images: ${project.images.length}` : '',
      tasks.length ? `linked tasks: ${tasks.length}` : '',
      logs.length ? `linked logs: ${logs.length}` : ''
    ].filter(Boolean),
    risks: (wiki?.gaps || []).slice(0, 4),
    nextActions
  };
}

function writeProject(project) {
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, `${project.slug}.json`), `${JSON.stringify(project, null, 2)}\n`);
}

function createSyncLog({ job, project, wiki, evaluation, reason }) {
  const date = localDate();
  const idPart = job?.id ? `-${job.id.slice(-6)}` : '';
  const slug = slugify(`${date}-github-sync-${project.slug}${idPart}`);
  const before = job?.before ? job.before.slice(0, 7) : undefined;
  const after = job?.after ? job.after.slice(0, 7) : undefined;
  const fullName = job?.repo?.fullName || `${wiki?.repo?.owner || 'unknown'}/${wiki?.repo?.name || project.slug}`;
  const content = [
    `GitHub ${job?.event || reason || 'sync'} processed for ${fullName}.`,
    `Project: ${project.title} (${project.slug}).`,
    job?.ref ? `Ref: ${job.ref}.` : '',
    before || after ? `Commit range: ${before || '?'} -> ${after || '?'}.` : '',
    wiki ? `Wiki snapshot: ${wiki.fileTree?.totalFiles || 0} files, ${(wiki.frameworks || []).join(', ') || 'no framework detected'}.` : 'Wiki snapshot was not available.',
    `Progress/status: ${evaluation.status} at ${evaluation.progress}%.`,
    evaluation.nextActions?.length ? `Next: ${evaluation.nextActions.join(' / ')}` : ''
  ].filter(Boolean).join('\n');
  const log = {
    slug,
    title: `GitHub sync: ${project.title}`,
    date,
    content,
    tags: uniq(['sync', 'github', project.slug, fullName.toLowerCase()])
  };
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(path.join(logDir, `${slug}.json`), `${JSON.stringify(log, null, 2)}\n`);
  return log;
}

export function refreshProjectSignals(slug, options = {}) {
  const projectPath = path.join(projectDir, `${slug}.json`);
  if (!fs.existsSync(projectPath)) return { applied: false, reason: `project ${slug} not found` };

  const project = readJson(projectPath);
  const wikiPath = path.join(wikiDir, `${slug}.json`);
  const wiki = fs.existsSync(wikiPath) ? readJson(wikiPath) : undefined;
  const tasks = readJsonDir(taskDir).filter(task => task.projectSlug === slug || task.sourceSlug === slug);
  const existingLogs = readJsonDir(logDir).filter(log => (log.tags || []).includes(slug) || String(log.content || '').toLowerCase().includes(slug.toLowerCase()));
  const evaluation = evaluateProjectSignals(project, wiki, tasks, existingLogs);
  const updatedProject = {
    ...project,
    status: evaluation.status,
    progress: evaluation.progress,
    progressEvaluation: evaluation,
    nextActions: evaluation.nextActions,
    updated: localDate()
  };
  writeProject(updatedProject);
  const log = options.skipLog ? undefined : createSyncLog({ ...options, project: updatedProject, wiki, evaluation });
  return {
    applied: true,
    project: updatedProject,
    evaluation,
    log,
    changed: project.status !== updatedProject.status || project.progress !== updatedProject.progress || JSON.stringify(project.nextActions || []) !== JSON.stringify(updatedProject.nextActions || [])
  };
}

export function projectSlugs() {
  if (!fs.existsSync(projectDir)) return [];
  return fs.readdirSync(projectDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace(/\.json$/, ''))
    .sort();
}
