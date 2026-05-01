import fs from 'node:fs/promises';
import path from 'node:path';
import type { Idea } from '@/lib/data';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function uniqueSlug(dir: string, base: string) {
  let slug = base || `idea-${Date.now()}`;
  let suffix = 2;
  while (true) {
    try {
      await fs.access(path.join(dir, `${slug}.json`));
      slug = `${base}-${suffix}`;
      suffix += 1;
    } catch {
      return slug;
    }
  }
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

export async function createIdea(input: Omit<Idea, 'slug' | 'updated'> & { slug?: string; updated?: string }) {
  assertDurableLocalWrites();
  const today = localDate();
  const dir = path.join(process.cwd(), 'content', 'ideas');
  await fs.mkdir(dir, { recursive: true });
  const slug = await uniqueSlug(dir, slugify(input.slug || input.title));
  const score = Math.max(1, Math.min(100, Math.round(input.score)));

  const idea: Idea = {
    slug,
    title: input.title,
    status: input.status,
    score,
    summary: input.summary,
    tags: input.tags.length ? input.tags : ['inbox'],
    next: input.next,
    analysis: input.analysis,
    relatedKnowledge: input.relatedKnowledge,
    analyzedAt: input.analyzedAt,
    updated: input.updated || today
  };

  await fs.writeFile(path.join(dir, `${slug}.json`), `${JSON.stringify(idea, null, 2)}\n`, 'utf8');
  return idea;
}

export async function writeIdea(idea: Idea) {
  assertDurableLocalWrites();
  const dir = path.join(process.cwd(), 'content', 'ideas');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${idea.slug}.json`), `${JSON.stringify(idea, null, 2)}\n`, 'utf8');
}

export async function updateIdea(idea: Idea) {
  const today = localDate();
  const updated = { ...idea, updated: today };
  await writeIdea(updated);
  return updated;
}
