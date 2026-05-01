import fs from 'node:fs/promises';
import path from 'node:path';
import type { KnowledgeNote } from '@/lib/data';
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
  let slug = base || `note-${Date.now()}`;
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

export async function createKnowledgeNote(input: Omit<KnowledgeNote, 'slug' | 'capturedAt' | 'updated'> & { slug?: string; capturedAt?: string; updated?: string }) {
  assertDurableLocalWrites();
  const today = localDate();
  const dir = path.join(process.cwd(), 'content', 'knowledge');
  await fs.mkdir(dir, { recursive: true });
  const slug = await uniqueSlug(dir, slugify(input.slug || input.title));

  const note: KnowledgeNote = {
    slug,
    title: input.title,
    type: input.type,
    status: input.status,
    summary: input.summary,
    keyPoints: input.keyPoints,
    tags: input.tags.length ? input.tags : ['inbox'],
    relatedProjects: input.relatedProjects,
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    confidence: input.confidence,
    next: input.next,
    similar: input.similar,
    analysis: input.analysis,
    rawExtract: input.rawExtract,
    analyzedAt: input.analyzedAt,
    capturedAt: input.capturedAt || today,
    updated: input.updated || today
  };

  await writeKnowledgeNote(note);
  return note;
}

export async function updateKnowledgeNote(note: KnowledgeNote) {
  const today = localDate();
  await writeKnowledgeNote({ ...note, updated: today });
  return { ...note, updated: today };
}

export async function writeKnowledgeNote(note: KnowledgeNote) {
  assertDurableLocalWrites();
  const dir = path.join(process.cwd(), 'content', 'knowledge');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${note.slug}.json`), `${JSON.stringify(note, null, 2)}\n`, 'utf8');
}
