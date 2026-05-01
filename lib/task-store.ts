import fs from 'node:fs/promises';
import path from 'node:path';
import type { Task } from '@/lib/data';
import { localDate } from '@/lib/brain-analysis';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

function dir() {
  return path.join(process.cwd(), 'content', 'tasks');
}

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

async function uniqueSlug(base: string) {
  let slug = base || `task-${Date.now()}`;
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

export async function createTask(input: Omit<Task, 'slug' | 'createdAt' | 'updated'> & { slug?: string; createdAt?: string; updated?: string }) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  const today = localDate();
  const slug = await uniqueSlug(slugify(input.slug || input.title));
  const task: Task = {
    slug,
    title: input.title,
    status: input.status,
    priority: input.priority,
    sourceType: input.sourceType,
    sourceSlug: input.sourceSlug,
    projectSlug: input.projectSlug,
    summary: input.summary,
    due: input.due,
    createdAt: input.createdAt || today,
    updated: input.updated || today
  };
  await writeTask(task);
  return task;
}

export async function writeTask(task: Task) {
  assertDurableLocalWrites();
  await fs.mkdir(dir(), { recursive: true });
  await fs.writeFile(path.join(dir(), `${task.slug}.json`), `${JSON.stringify(task, null, 2)}\n`, 'utf8');
}

export async function updateTask(task: Task) {
  const updated = { ...task, updated: localDate() };
  await writeTask(updated);
  return updated;
}
