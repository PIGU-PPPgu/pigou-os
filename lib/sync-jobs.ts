import fs from 'node:fs/promises';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SyncJob } from '@/lib/data';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

const jobDir = () => path.join(process.cwd(), 'content', 'sync-jobs');

function slugPart(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

export function verifyGitHubSignature(rawBody: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function enqueueSyncJob(input: Omit<SyncJob, 'id' | 'requestedAt' | 'attempts' | 'artifacts' | 'status'> & { id?: string; status?: SyncJob['status']; artifacts?: string[] }) {
  assertDurableLocalWrites();
  const now = new Date().toISOString();
  const id = input.id || `${Date.now()}-${slugPart(input.repo.fullName)}-${Math.random().toString(36).slice(2, 8)}`;
  const job: SyncJob = {
    ...input,
    id,
    requestedAt: now,
    attempts: 0,
    status: input.status || 'queued',
    artifacts: input.artifacts || []
  };
  await fs.mkdir(jobDir(), { recursive: true });
  await fs.writeFile(path.join(jobDir(), `${id}.json`), `${JSON.stringify(job, null, 2)}\n`, 'utf8');
  return job;
}
