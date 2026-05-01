import fs from 'node:fs/promises';
import path from 'node:path';
import type { Log } from '@/lib/data';
import { localDate } from '@/lib/brain-analysis';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

function dir() {
  return path.join(process.cwd(), 'content', 'log');
}

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

async function uniqueSlug(base: string) {
  let slug = base || `log-${Date.now()}`;
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

export async function createLog(input: Omit<Log, 'slug'> & { slug?: string }) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  const slug = await uniqueSlug(slugify(input.slug || `${input.date}-${input.title}`));
  const log: Log = {
    slug,
    title: input.title,
    date: input.date || localDate(),
    content: input.content,
    tags: input.tags.length ? input.tags : ['daily']
  };
  await writeLog(log);
  return log;
}

export async function writeLog(log: Log) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), `${log.slug}.json`), `${JSON.stringify(log, null, 2)}\n`, 'utf8');
}

export async function updateLog(log: Log) {
  await writeLog(log);
  return log;
}
