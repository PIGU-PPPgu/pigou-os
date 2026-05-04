import fs from 'node:fs/promises';
import path from 'node:path';
import type { Idea, Project } from '@/lib/data';
import { localDate } from '@/lib/brain-analysis';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

function dir() {
  return path.join(process.cwd(), 'content', 'projects');
}

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

async function uniqueSlug(base: string) {
  let slug = base || `project-${Date.now()}`;
  let suffix = 2;
  while (true) {
    try {
      await fs.access(path.join(dir(), `${slug}.json`));
      slug = `${base}-${suffix}`;
      suffix += 1;
    } catch {
      return slug;
    }
  }
}

export async function createProject(input: Omit<Project, 'slug' | 'updated'> & { slug?: string; updated?: string }) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  const slug = await uniqueSlug(slugify(input.slug || input.title));
  const project: Project = {
    slug,
    title: input.title,
    status: input.status,
    priority: input.priority,
    summary: input.summary,
    explanation: input.explanation,
    domain: input.domain,
    source: input.source,
    visibility: input.visibility,
    readme: input.readme,
    images: input.images,
    progress: Math.max(0, Math.min(100, Math.round(input.progress))),
    progressEvaluation: input.progressEvaluation,
    statusSuggestionReview: input.statusSuggestionReview,
    prioritySuggestion: input.prioritySuggestion,
    prioritySuggestionReview: input.prioritySuggestionReview,
    goals: input.goals,
    nextActions: input.nextActions,
    links: input.links,
    updated: input.updated || localDate()
  };
  await writeProject(project);
  return project;
}

export async function createProjectFromIdea(idea: Idea) {
  return createProject({
    title: idea.title,
    status: 'idea',
    priority: idea.score >= 80 ? 'high' : idea.score >= 65 ? 'medium' : 'low',
    summary: idea.summary,
    explanation: idea.analysis?.opportunity,
    domain: idea.tags[0],
    source: `idea:${idea.slug}`,
    visibility: 'private',
    progress: idea.status === 'building' ? 35 : idea.status === 'validated' ? 25 : 10,
    goals: [
      idea.analysis?.userPain || 'Clarify the target user pain.',
      idea.analysis?.opportunity || 'Validate the opportunity with real evidence.'
    ].filter(Boolean),
    nextActions: [
      idea.analysis?.nextExperiment || idea.next || 'Design the smallest validation experiment.'
    ]
  });
}

export async function writeProject(project: Project) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), `${project.slug}.json`), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
}

export async function updateProject(project: Project) {
  const updated = { ...project, updated: localDate() };
  await writeProject(updated);
  return updated;
}
