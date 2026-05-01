import type { Project, ProjectWikiSnapshot } from '@/lib/data';

export type ProjectWiki = {
  repo?: { owner: string; name: string; url: string; deepwikiUrl: string };
  snapshot?: ProjectWikiSnapshot;
  confidence: 'high' | 'medium' | 'low';
  facts: string[];
  inferredModules: { name: string; evidence: string; confidence: 'high' | 'medium' | 'low' }[];
  graph: { from: string; to: string; label: string }[];
  gaps: string[];
  next: string[];
};

function parseRepo(project: Project) {
  const source = project.source?.match(/^github:([^/]+)\/(.+)$/);
  const githubUrl = project.links?.find(link => link.url.includes('github.com'))?.url;
  const link = githubUrl?.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  const owner = source?.[1] || link?.[1];
  const name = source?.[2] || link?.[2];
  if (!owner || !name) return undefined;
  const cleanName = name.replace(/\.git$/, '');
  return {
    owner,
    name: cleanName,
    url: `https://github.com/${owner}/${cleanName}`,
    deepwikiUrl: `https://deepwiki.com/${owner}/${cleanName}`
  };
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some(word => lower.includes(word));
}

function addModule(modules: ProjectWiki['inferredModules'], name: string, evidence: string, confidence: 'high' | 'medium' | 'low' = 'medium') {
  if (modules.some(module => module.name === name)) return;
  modules.push({ name, evidence, confidence });
}

export function generateProjectWiki(project: Project, snapshot?: ProjectWikiSnapshot): ProjectWiki {
  const repo = parseRepo(project);
  if (snapshot) {
    return {
      repo: {
        owner: snapshot.repo.owner,
        name: snapshot.repo.name,
        url: snapshot.repo.url,
        deepwikiUrl: `https://deepwiki.com/${snapshot.repo.owner}/${snapshot.repo.name}`
      },
      snapshot,
      confidence: snapshot.fileTree.totalFiles ? 'high' : 'medium',
      facts: [
        `Repository: ${snapshot.repo.owner}/${snapshot.repo.name}`,
        `Default branch: ${snapshot.repo.defaultBranch}`,
        `Indexed files: ${snapshot.fileTree.totalFiles}`,
        `Primary language: ${snapshot.repo.language || 'unknown'}`,
        `Frameworks: ${snapshot.frameworks.length ? snapshot.frameworks.join(', ') : 'not detected'}`,
        `Last pushed: ${snapshot.repo.pushedAt ? snapshot.repo.pushedAt.slice(0, 10) : 'unknown'}`,
        `Snapshot: ${snapshot.generatedAt.slice(0, 10)}`
      ],
      inferredModules: snapshot.modules.length
        ? snapshot.modules.map(module => ({
          name: module.name,
          evidence: `${module.kind}: ${module.evidence.join(' / ')}`,
          confidence: 'high'
        }))
        : [{ name: 'Repository root', evidence: 'The repo was indexed, but no major module directory was detected.', confidence: 'medium' }],
      graph: snapshot.graph.length ? snapshot.graph : [
        { from: 'Repository', to: project.title, label: 'indexes' }
      ],
      gaps: snapshot.gaps.length ? snapshot.gaps : ['No file-level summaries have been generated yet.'],
      next: [
        'Generate per-file summaries for important source files.',
        'Connect modules to project goals and next actions.',
        'Detect stale README sections by comparing code signals with project description.',
        'Persist historical wiki snapshots to show architecture drift.'
      ]
    };
  }

  const corpus = [
    project.title,
    project.summary,
    project.explanation,
    project.domain,
    project.source,
    ...(project.readme ?? []),
    ...project.goals,
    ...project.nextActions
  ].filter(Boolean).join('\n');
  const modules: ProjectWiki['inferredModules'] = [];

  if (project.images?.length) {
    addModule(modules, 'User-facing surface', `${project.images.length} README image(s) or product asset(s) are attached.`, 'high');
  }
  if (includesAny(corpus, ['taro', 'wechat', '小程序', '移动端'])) {
    addModule(modules, 'Mini program client', 'Project text mentions Taro / WeChat / mini program / mobile usage.', 'high');
  }
  if (includesAny(corpus, ['next.js', 'tailwind', 'frontend', 'react', '页面', 'dashboard', 'console'])) {
    addModule(modules, 'Web interface', 'Project text mentions Next.js, Tailwind, React, dashboard, or frontend surfaces.', 'medium');
  }
  if (includesAny(corpus, ['agent', 'skill', 'workflow', 'codex', 'ai', 'llm', 'prompt'])) {
    addModule(modules, 'Agent workflow layer', 'Project text mentions agents, skills, workflows, prompts, or LLM usage.', 'medium');
  }
  if (includesAny(corpus, ['json', 'supabase', 'postgres', 'database', '数据', 'analysis', '分析', '记录'])) {
    addModule(modules, 'Data and records layer', 'Project text mentions JSON, database, records, analytics, or data handling.', 'medium');
  }
  if (includesAny(corpus, ['latex', 'paper', '论文', 'research', '课题', '模板'])) {
    addModule(modules, 'Research document layer', 'Project text mentions papers, LaTeX, research, or templates.', 'medium');
  }
  if (!modules.length) {
    addModule(modules, 'Unknown implementation surface', 'Not enough README or code signals are available yet.', 'low');
  }

  const facts = [
    `Status: ${project.status}`,
    `Priority: ${project.priority}`,
    `Progress reading: ${project.progress}%`,
    `Visibility: ${project.visibility === 'private' ? 'private / links hidden' : 'public or linkable'}`,
    repo ? `Repository signal: ${repo.owner}/${repo.name}` : 'Repository signal: not available',
    project.readme?.length ? `README excerpts: ${project.readme.length}` : 'README excerpts: missing'
  ];

  const graph: ProjectWiki['graph'] = [
    { from: 'README / project notes', to: 'Project purpose', label: 'explains' },
    { from: 'Goals', to: 'Success direction', label: 'define' },
    { from: 'Next actions', to: 'Execution queue', label: 'feeds' },
    ...modules.slice(0, 4).map(module => ({ from: module.name, to: project.title, label: 'supports' }))
  ];

  const gaps = [
    !repo && 'No GitHub repository URL is available, so code graph generation cannot start.',
    !project.readme?.length && 'No README excerpt is available, so the wiki has weak product context.',
    'No repository file tree has been indexed yet.',
    'No dependency graph, entrypoint map, or module-level code summary has been generated yet.'
  ].filter(Boolean) as string[];

  const next = [
    repo ? `Index ${repo.owner}/${repo.name} README, file tree, package metadata, and key source files.` : 'Add a GitHub repo source or local code path.',
    'Generate module summaries from real files instead of project-card prose.',
    'Connect project wiki nodes to related knowledge notes and next actions.',
    'Persist wiki snapshots so changes over time are visible.'
  ];

  return {
    repo,
    confidence: repo && project.readme?.length ? 'medium' : 'low',
    facts,
    inferredModules: modules,
    graph,
    gaps,
    next
  };
}
