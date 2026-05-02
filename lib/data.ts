import fs from 'fs';
import path from 'path';

export type ProjectProgressEvaluation = {
  generatedAt: string;
  model: string;
  source: 'ai' | 'algorithm';
  progress: number;
  status: 'idea'|'building'|'paused'|'shipped'|'archived';
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  rationale: string;
  dimensions: { name: string; score: number; max: number; reason: string }[];
  evidence: string[];
  risks: string[];
  nextActions: string[];
};

export type ProjectStatusSuggestionReview = {
  id: string;
  action: 'applied' | 'ignored';
  reviewedAt: string;
  suggestedStatus: ProjectProgressEvaluation['status'];
  suggestedProgress: number;
  confidence: ProjectProgressEvaluation['confidence'];
  evidence: string[];
  summary: string;
};

export type ProjectPriority = 'high' | 'medium' | 'low';

export type ProjectPrioritySuggestion = {
  id: string;
  generatedAt: string;
  model: string;
  source: 'ai' | 'algorithm';
  currentPriority: ProjectPriority;
  suggestedPriority: ProjectPriority;
  confidence: 'low' | 'medium' | 'high';
  score: number;
  rationale: string;
  evidence: string[];
  dimensions: { name: string; score: number; max: number; reason: string }[];
};

export type ProjectPrioritySuggestionReview = {
  id: string;
  action: 'applied' | 'ignored';
  reviewedAt: string;
  suggestedPriority: ProjectPriority;
  confidence: ProjectPrioritySuggestion['confidence'];
  evidence: string[];
  rationale: string;
};

export type Project = {
  slug: string; title: string; status: 'idea'|'building'|'paused'|'shipped'|'archived'; priority: ProjectPriority;
  summary: string; explanation?: string; domain?: string; source?: string; visibility?: 'public'|'private'; readme?: string[]; images?: { src: string; alt: string; public?: boolean }[]; progress: number; progressEvaluation?: ProjectProgressEvaluation; statusSuggestionReview?: ProjectStatusSuggestionReview; prioritySuggestion?: ProjectPrioritySuggestion; prioritySuggestionReview?: ProjectPrioritySuggestionReview; goals: string[]; nextActions: string[]; links?: { label: string; url: string }[]; updated: string;
};
export type KnowledgePlatform = 'github' | 'wechat' | 'xiaohongshu' | 'zhihu' | 'bilibili' | 'website' | 'paper' | 'manual' | 'other';
export type KnowledgeAnalysis = {
  intent: string;
  usefulness: string;
  projectLinks: string[];
  ideaLinks: string[];
  actionSuggestions: string[];
  relationReasoning: string;
  confidence: 'low' | 'medium' | 'high';
};
export type IdeaAnalysis = {
  userPain: string;
  opportunity: string;
  feasibility: string;
  risks: string[];
  evidenceLinks: string[];
  suggestedProject?: string;
  nextExperiment: string;
};
export type Task = {
  slug: string;
  title: string;
  status: 'next' | 'doing' | 'waiting' | 'done' | 'archived';
  priority: 'P0' | 'P1' | 'P2';
  sourceType: 'knowledge' | 'idea' | 'project' | 'manual';
  sourceSlug: string;
  projectSlug?: string;
  summary: string;
  due?: string;
  createdAt: string;
  updated: string;
};
export type LlmWikiEdge = {
  from: string;
  to: string;
  type: 'supports' | 'inspires' | 'blocks' | 'validates' | 'becomes' | 'relates';
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};
export type LlmWikiGraph = {
  slug: string;
  generatedAt: string;
  scope: 'all' | 'knowledge' | 'ideas' | 'projects';
  nodes: {
    id: string;
    type: 'knowledge' | 'idea' | 'project' | 'task' | 'topic';
    title: string;
    summary?: string;
    status?: string;
    score?: number;
    platform?: KnowledgePlatform;
    x?: number;
    y?: number;
  }[];
  edges: LlmWikiEdge[];
  analysis?: {
    summary: string;
    clusters: { topic: string; nodes: string[]; reason: string }[];
    nextActions: string[];
    notableConnections?: (LlmWikiEdge & { note?: string })[];
  };
};
export type ProjectWikiSnapshot = {
  slug: string;
  repo: { owner: string; name: string; url: string; defaultBranch: string; private: boolean; pushedAt?: string; language?: string };
  generatedAt: string;
  readme?: { title?: string; summary: string[] };
  fileTree: { totalFiles: number; truncated: boolean; topDirectories: { name: string; count: number }[]; extensions: { ext: string; count: number }[] };
  package?: { manager?: string; scripts: string[]; dependencies: string[]; devDependencies: string[] };
  frameworks: string[];
  modules: { name: string; kind: string; evidence: string[]; files: string[] }[];
  entrypoints: string[];
  importantFiles: { path: string; reason: string }[];
  graph: { from: string; to: string; label: string }[];
  gaps: string[];
  codeInsights?: {
    generatedAt: string;
    model: string;
    filesAnalyzed: { path: string; chars: number }[];
    architectureSummary: string;
    modules: { name: string; summary: string; responsibilities: string[]; files: string[] }[];
    dataFlow: string[];
    entrypoints: { path: string; role: string }[];
    risks: { level: 'low' | 'medium' | 'high'; title: string; detail: string }[];
    nextQuestions: string[];
  };
};
export type Idea = { slug: string; title: string; status: 'spark'|'validated'|'building'|'killed'; score: number; summary: string; tags: string[]; next?: string; analysis?: IdeaAnalysis; relatedKnowledge?: string[]; analyzedAt?: string; updated: string };
export type Log = { slug: string; title: string; date: string; content: string; tags: string[] };
export type ContributionDay = { date: string; count: number; weekday: number };
export type ContributionActivity = { owner: string; generatedAt: string; totalContributions: number; days: ContributionDay[] };
export type SyncJob = {
  id: string;
  source: 'github-webhook' | 'manual' | 'cron';
  status: 'queued' | 'running' | 'success' | 'failed' | 'needs-review';
  repo: { owner: string; name: string; fullName: string; url?: string; private?: boolean };
  projectSlug?: string;
  event?: string;
  ref?: string;
  before?: string;
  after?: string;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  attempts: number;
  withLlm?: boolean;
  warmDeepWiki?: boolean;
  summary?: string;
  error?: string;
  artifacts: string[];
};
export type KnowledgeNote = {
  slug: string;
  title: string;
  type: 'source'|'insight'|'decision'|'pattern'|'question'|'asset';
  status: 'raw'|'processed'|'linked';
  summary: string;
  keyPoints: string[];
  tags: string[];
  relatedProjects?: string[];
  sourceUrl?: string;
  platform?: KnowledgePlatform;
  confidence: 'low'|'medium'|'high';
  next?: string;
  similar?: { slug: string; title: string; score: number }[];
  analysis?: KnowledgeAnalysis;
  rawExtract?: string;
  analyzedAt?: string;
  capturedAt: string;
  updated: string;
};

function readJson<T>(dir: string): T[] {
  const full = path.join(process.cwd(), 'content', dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')) as T);
}
export const getProjects = () => readJson<Project>('projects').sort((a,b) => b.updated.localeCompare(a.updated));
export const getIdeas = () => readJson<Idea>('ideas').sort((a,b) => b.updated.localeCompare(a.updated));
export const getLogs = () => readJson<Log>('log').sort((a,b) => b.date.localeCompare(a.date));
export const getKnowledge = () => readJson<KnowledgeNote>('knowledge').sort((a,b) => b.updated.localeCompare(a.updated));
export const getTasks = () => readJson<Task>('tasks').sort((a,b) => b.updated.localeCompare(a.updated));
export const getLlmWikiGraphs = () => readJson<LlmWikiGraph>('llm-wiki').sort((a,b) => b.generatedAt.localeCompare(a.generatedAt));
export const getLlmWikiGraph = () => getLlmWikiGraphs()[0] ?? null;
export const getProjectWikis = () => readJson<ProjectWikiSnapshot>('project-wikis');
export const getSyncJobs = () => readJson<SyncJob>('sync-jobs').sort((a,b) => b.requestedAt.localeCompare(a.requestedAt));
export const getContributionActivity = () => readJson<ContributionActivity>('activity')[0] ?? { owner: 'PIGU-PPPgu', generatedAt: '', totalContributions: 0, days: [] };
export const getProject = (slug: string) => getProjects().find(p => p.slug === slug);
export const getProjectWikiSnapshot = (slug: string) => getProjectWikis().find(wiki => wiki.slug === slug);
export const getKnowledgeNote = (slug: string) => getKnowledge().find(note => note.slug === slug);
export const getIdea = (slug: string) => getIdeas().find(idea => idea.slug === slug);
export const getTask = (slug: string) => getTasks().find(task => task.slug === slug);
const priorityWeight: Record<Project['priority'], number> = { high: 0, medium: 1, low: 2 };
const statusWeight: Record<Project['status'], number> = { building: 0, idea: 1, paused: 2, shipped: 3, archived: 4 };
export const getAllTasks = () => getProjects()
  .flatMap(p => p.nextActions.map((task, i) => ({ task, project: p.title, slug: p.slug, priority: p.priority, status: p.status, updated: p.updated, index: i })))
  .sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || priorityWeight[a.priority] - priorityWeight[b.priority] || b.updated.localeCompare(a.updated));
