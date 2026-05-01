import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { assertDurableLocalWrites, StorageConfigurationError } from '@/lib/storage-guard';

const contentDirs: Record<string, string> = {
  knowledge: 'knowledge',
  ideas: 'ideas',
  log: 'log',
  projects: 'projects',
  tasks: 'tasks'
};

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  try {
    assertDurableLocalWrites();
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const type = typeof body?.type === 'string' ? body.type : '';
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const dir = contentDirs[type];
  if (!dir || !slug || slug.includes('/') || slug.includes('..')) {
    return NextResponse.json({ ok: false, message: 'Invalid delete target.' }, { status: 400 });
  }

  const file = path.join(process.cwd(), 'content', dir, `${slug}.json`);
  await fs.unlink(file).catch(() => null);
  return NextResponse.json({ ok: true, type, slug });
}
