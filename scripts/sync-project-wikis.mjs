import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

loadEnvLocal();

const ownerFallback = process.env.GITHUB_OWNER || 'PIGU-PPPgu';
const contentDir = path.join(process.cwd(), 'content', 'projects');
const wikiDir = path.join(process.cwd(), 'content', 'project-wikis');
const dryRun = process.argv.includes('--dry-run');
const withLlm = process.argv.includes('--with-llm');
const only = process.argv.find(arg => arg.startsWith('--project='))?.split('=')[1];

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function runGh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function ghJson(endpoint) {
  return JSON.parse(runGh(['api', endpoint]));
}

function parseRepo(project) {
  const githubSource = project.source?.match(/^github:([^/]+)\/(.+)$/);
  if (githubSource) return { owner: githubSource[1], name: githubSource[2].replace(/\.git$/, '') };

  const privateSource = project.source?.match(/^private:(.+)$/);
  if (privateSource) return { owner: ownerFallback, name: privateSource[1].replace(/\.git$/, '') };

  const githubUrl = project.links?.find(link => link.url.includes('github.com'))?.url;
  const link = githubUrl?.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  if (link) return { owner: link[1], name: link[2].replace(/\.git$/, '') };

  return undefined;
}

function readProjects() {
  return fs.readdirSync(contentDir)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf8')))
    .filter(project => !only || project.slug === only);
}

function readReadme(owner, repo) {
  try {
    const raw = ghJson(`repos/${owner}/${repo}/readme`);
    const text = Buffer.from(raw.content.replace(/\n/g, ''), 'base64').toString('utf8');
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const summary = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[[^\]]*]\([^)]+\)/g, '')
      .replace(/\[[^\]]+]\([^)]+\)/g, match => match.replace(/^\[|\]\([^)]+\)$/g, ''))
      .split(/\n{2,}/)
      .map(part => part.replace(/^#+\s*/gm, '').replace(/[*_`>#|]/g, '').replace(/\s+/g, ' ').trim())
      .filter(part => part.length > 40)
      .slice(0, 6);
    return { title, summary };
  } catch {
    return undefined;
  }
}

function readFile(owner, repo, filePath, branch) {
  try {
    const raw = ghJson(`repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
    if (raw.encoding !== 'base64' || typeof raw.content !== 'string') return undefined;
    return Buffer.from(raw.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch {
    return undefined;
  }
}

function withV1(url) {
  if (!url) return 'https://api.openai.com/v1';
  return url.replace(/\/$/, '').endsWith('/v1') ? url.replace(/\/$/, '') : `${url.replace(/\/$/, '')}/v1`;
}

function fileTree(owner, repo, branch) {
  try {
    const tree = ghJson(`repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    return {
      truncated: Boolean(tree.truncated),
      files: tree.tree.filter(item => item.type === 'blob').map(item => item.path)
    };
  } catch {
    return { truncated: false, files: [] };
  }
}

function topCounts(items, limit = 8) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, count]) => ({ name, count }));
}

function extension(pathName) {
  const base = path.basename(pathName);
  if (!base.includes('.')) return '[none]';
  return `.${base.split('.').pop()}`;
}

function packageInfo(owner, repo, branch, files) {
  const pkgPath = files.includes('package.json') ? 'package.json' : files.find(file => file.endsWith('/package.json'));
  if (!pkgPath) return undefined;
  const raw = readFile(owner, repo, pkgPath, branch);
  if (!raw) return undefined;
  try {
    const json = JSON.parse(raw);
    const manager = files.includes('pnpm-lock.yaml') || files.includes('pnpm-workspace.yaml')
      ? 'pnpm'
      : files.includes('yarn.lock')
        ? 'yarn'
        : files.includes('package-lock.json')
          ? 'npm'
          : undefined;
    return {
      manager,
      scripts: Object.keys(json.scripts ?? {}).slice(0, 12),
      dependencies: Object.keys(json.dependencies ?? {}).slice(0, 24),
      devDependencies: Object.keys(json.devDependencies ?? {}).slice(0, 24)
    };
  } catch {
    return undefined;
  }
}

function detectFrameworks(files, pkg) {
  const deps = new Set([...(pkg?.dependencies ?? []), ...(pkg?.devDependencies ?? [])]);
  const frameworks = new Set();
  if (deps.has('next') || files.some(file => file.startsWith('app/') || file.startsWith('pages/'))) frameworks.add('Next.js');
  if (deps.has('react')) frameworks.add('React');
  if (deps.has('@tarojs/taro') || files.some(file => file.includes('app.config') || file.includes('project.config.json'))) frameworks.add('Taro / WeChat Mini Program');
  if (deps.has('tailwindcss') || files.some(file => file.includes('tailwind.config'))) frameworks.add('Tailwind CSS');
  if (deps.has('fastify')) frameworks.add('Fastify');
  if (deps.has('zod')) frameworks.add('Zod');
  if (files.some(file => file.endsWith('.py'))) frameworks.add('Python');
  if (files.some(file => file.endsWith('.tex'))) frameworks.add('LaTeX');
  if (files.some(file => file.endsWith('.ino') || file.includes('platformio.ini'))) frameworks.add('Embedded / PlatformIO');
  return [...frameworks];
}

function importantFiles(files) {
  const rules = [
    ['package.json', 'Node package manifest'],
    ['pnpm-workspace.yaml', 'Workspace layout'],
    ['next.config.mjs', 'Next.js runtime config'],
    ['app/page.tsx', 'App Router home page'],
    ['app/api', 'Server API route'],
    ['src/app.tsx', 'Taro app entry'],
    ['src/app.config.ts', 'Mini program app config'],
    ['project.config.json', 'WeChat project config'],
    ['README.md', 'Human project explanation'],
    ['docker-compose.yml', 'Local infrastructure'],
    ['platformio.ini', 'Embedded build config']
  ];
  const picked = [];
  for (const [needle, reason] of rules) {
    const match = files.find(file => file === needle || file.startsWith(`${needle}/`) || file.includes(`/${needle}`));
    if (match && !picked.some(item => item.path === match)) picked.push({ path: match, reason });
  }
  return picked.slice(0, 12);
}

function sourceCandidate(file) {
  const ext = path.extname(file).toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|woff|ttf|mp3|mp4)$/i.test(file)) return false;
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.py', '.tex', '.yml', '.yaml', '.css', '.scss', '.wxml', '.wxss'].includes(ext)
    || ['README', 'Dockerfile', 'Makefile'].includes(path.basename(file));
}

function insightFilePaths(files, important) {
  const preferred = [
    ...important.map(file => file.path),
    'package.json',
    'README.md',
    'app/page.tsx',
    'app/layout.tsx',
    'src/App.tsx',
    'src/app.config.ts',
    'src/pages/Dashboard.tsx',
    'src/pages/AIChat.tsx',
    'src/pages/ClassHub.tsx',
    'src/utils/index.ts'
  ];
  const picks = [];
  for (const candidate of preferred) {
    if (files.includes(candidate) && sourceCandidate(candidate) && !picks.includes(candidate)) picks.push(candidate);
  }
  for (const file of files) {
    if (picks.length >= 8) break;
    if (!sourceCandidate(file)) continue;
    if (file.includes('/node_modules/') || file.includes('/dist/') || file.includes('/build/')) continue;
    if (!picks.includes(file)) picks.push(file);
  }
  return picks.slice(0, 8);
}

async function createCodeInsights({ project, repoRef, branch, files, important, pkg, frameworks, modules }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (!withLlm || !apiKey) return undefined;

  const selected = insightFilePaths(files, important);
  const fileContexts = selected.map(file => {
    const content = readFile(repoRef.owner, repoRef.name, file, branch) || '';
    return {
      path: file,
      chars: content.length,
      content: content.slice(0, 5000)
    };
  }).filter(file => file.content.trim());

  if (!fileContexts.length) return undefined;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      architectureSummary: { type: 'string' },
      modules: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            summary: { type: 'string' },
            responsibilities: { type: 'array', items: { type: 'string' } },
            files: { type: 'array', items: { type: 'string' } }
          },
          required: ['name', 'summary', 'responsibilities', 'files']
        }
      },
      dataFlow: { type: 'array', items: { type: 'string' } },
      entrypoints: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string' },
            role: { type: 'string' }
          },
          required: ['path', 'role']
        }
      },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            level: { type: 'string', enum: ['low', 'medium', 'high'] },
            title: { type: 'string' },
            detail: { type: 'string' }
          },
          required: ['level', 'title', 'detail']
        }
      },
      nextQuestions: { type: 'array', items: { type: 'string' } }
    },
    required: ['architectureSummary', 'modules', 'dataFlow', 'entrypoints', 'risks', 'nextQuestions']
  };

  const response = await fetch(`${withV1(process.env.OPENAI_BASE_URL)}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'project_code_insights',
          strict: true,
          schema
        }
      },
      messages: [
        {
          role: 'system',
          content: '你是 Pigou OS 的项目 DeepWiki 代码分析器。只根据提供的 README、文件树、package 信息和源码片段总结，不要假装读过未提供的文件。中文输出，具体、克制、可行动。'
        },
        {
          role: 'user',
          content: JSON.stringify({
            project: {
              slug: project.slug,
              title: project.title,
              summary: project.summary,
              goals: project.goals,
              nextActions: project.nextActions
            },
            repo: repoRef,
            frameworks,
            package: pkg,
            modules,
            files: fileContexts
          }, null, 2)
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`LLM code insight failed: HTTP ${response.status}`);
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return undefined;
  const parsed = parseInsightResponse(content, { project, model, fileContexts, modules });
  return {
    generatedAt: new Date().toISOString(),
    model,
    filesAnalyzed: fileContexts.map(file => ({ path: file.path, chars: file.chars })),
    architectureSummary: parsed.architectureSummary,
    modules: parsed.modules.slice(0, 8),
    dataFlow: parsed.dataFlow.slice(0, 8),
    entrypoints: parsed.entrypoints.slice(0, 8),
    risks: parsed.risks.slice(0, 8),
    nextQuestions: parsed.nextQuestions.slice(0, 8)
  };
}

function parseInsightResponse(content, fallback) {
  const candidates = [
    content,
    content.match(/```json\s*([\s\S]*?)```/i)?.[1],
    content.includes('{') && content.includes('}') ? content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1) : undefined
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next extraction strategy.
    }
  }

  return {
    architectureSummary: content.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim().slice(0, 900) || `${fallback.project.title} 的源码片段已读取，但模型未返回结构化 JSON。`,
    modules: fallback.modules.slice(0, 6).map(module => ({
      name: module.name,
      summary: module.evidence.join(' / '),
      responsibilities: module.evidence,
      files: module.files.slice(0, 4)
    })),
    dataFlow: ['模型返回了非结构化说明；当前先保留摘要，后续可重新运行 --with-llm 获取结构化数据流。'],
    entrypoints: fallback.fileContexts.slice(0, 5).map(file => ({ path: file.path, role: 'LLM analyzed source file' })),
    risks: [{
      level: 'medium',
      title: 'LLM response was not structured',
      detail: 'Provider returned Markdown instead of JSON, so Pigou OS stored a conservative summary rather than detailed structured insights.'
    }],
    nextQuestions: ['重新运行 sync:wiki -- --with-llm，或切换到更稳定支持 JSON response_format 的模型。']
  };
}

function modules(files) {
  const groups = [
    ['apps', 'Application workspace'],
    ['services', 'Service workspace'],
    ['packages', 'Shared package workspace'],
    ['app', 'Next.js App Router surface'],
    ['pages', 'Page routes'],
    ['components', 'Reusable UI components'],
    ['lib', 'Core application logic'],
    ['src/pages', 'Mini program pages'],
    ['src/components', 'Mini program components'],
    ['src', 'Source root'],
    ['scripts', 'Automation scripts'],
    ['content', 'Local content source'],
    ['public', 'Static assets'],
    ['docs', 'Documentation']
  ];
  const found = [];
  for (const [prefix, kind] of groups) {
    const matched = files.filter(file => file === prefix || file.startsWith(`${prefix}/`));
    if (!matched.length) continue;
    found.push({
      name: prefix,
      kind,
      evidence: [`${matched.length} file(s) under ${prefix}/`],
      files: matched.slice(0, 8)
    });
  }
  if (!found.length) {
    const dirs = topCounts(files.map(file => file.split('/')[0] || '[root]'), 6);
    return dirs.map(dir => ({
      name: dir.name,
      kind: 'Repository directory',
      evidence: [`${dir.count} file(s)`],
      files: files.filter(file => file.startsWith(`${dir.name}/`) || file === dir.name).slice(0, 8)
    }));
  }
  return found.slice(0, 10);
}

function graphFor(project, mods, pkg, frameworks) {
  const edges = [
    { from: 'GitHub repository', to: project.title, label: 'indexes' },
    ...frameworks.slice(0, 4).map(framework => ({ from: framework, to: project.title, label: 'powers' })),
    ...mods.slice(0, 5).map(module => ({ from: module.name, to: project.title, label: 'contains' }))
  ];
  if (pkg?.scripts?.length) edges.push({ from: 'package scripts', to: 'developer workflow', label: 'drives' });
  return edges.slice(0, 12);
}

async function syncProject(project) {
  const repoRef = parseRepo(project);
  if (!repoRef) return { skipped: true, reason: 'missing repo source' };

  const repo = ghJson(`repos/${repoRef.owner}/${repoRef.name}`);
  const branch = repo.default_branch || 'main';
  const tree = fileTree(repoRef.owner, repoRef.name, branch);
  const readme = readReadme(repoRef.owner, repoRef.name);
  const pkg = packageInfo(repoRef.owner, repoRef.name, branch, tree.files);
  const mods = modules(tree.files);
  const frameworks = detectFrameworks(tree.files, pkg);
  const topDirectories = topCounts(tree.files.map(file => file.includes('/') ? file.split('/')[0] : '[root]'));
  const extensions = topCounts(tree.files.map(extension), 10).map(item => ({ ext: item.name, count: item.count }));
  const important = importantFiles(tree.files);
  const gaps = [
    tree.truncated && 'GitHub tree response was truncated.',
    !readme && 'README could not be fetched.',
    !pkg && 'package.json could not be found or parsed.',
    !tree.files.length && 'Repository file tree could not be fetched.'
  ].filter(Boolean);

  const codeInsights = await createCodeInsights({ project, repoRef, branch, files: tree.files, important, pkg, frameworks, modules: mods });

  const snapshot = {
    slug: project.slug,
    repo: {
      owner: repoRef.owner,
      name: repoRef.name,
      url: repo.html_url,
      defaultBranch: branch,
      private: Boolean(repo.private),
      pushedAt: repo.pushed_at,
      language: repo.language
    },
    generatedAt: new Date().toISOString(),
    readme,
    fileTree: {
      totalFiles: tree.files.length,
      truncated: tree.truncated,
      topDirectories,
      extensions
    },
    package: pkg,
    frameworks,
    modules: mods,
    entrypoints: important.filter(file => /entry|page|config|manifest|workflow|runtime/i.test(file.reason)).map(file => file.path),
    importantFiles: important,
    graph: graphFor(project, mods, pkg, frameworks),
    gaps: codeInsights ? gaps : [...gaps, 'No LLM code insight snapshot has been generated yet. Run pnpm sync:wiki -- --with-llm.'],
    ...(codeInsights ? { codeInsights } : {})
  };

  if (!dryRun) {
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.writeFileSync(path.join(wikiDir, `${project.slug}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  }

  return { skipped: false, snapshot };
}

const projects = readProjects();
let synced = 0;
let skipped = 0;

for (const project of projects) {
  try {
    const result = await syncProject(project);
    if (result.skipped) {
      skipped += 1;
      console.log(`Skipped ${project.slug}: ${result.reason}`);
      continue;
    }
    synced += 1;
    console.log(`${dryRun ? 'Would sync' : 'Synced'} ${project.slug}: ${result.snapshot.repo.owner}/${result.snapshot.repo.name} (${result.snapshot.fileTree.totalFiles} files)`);
  } catch (error) {
    skipped += 1;
    console.log(`Skipped ${project.slug}: ${error.message}`);
  }
}

console.log(`${dryRun ? 'Would sync' : 'Synced'} ${synced} project wiki snapshot(s), skipped ${skipped}.`);
