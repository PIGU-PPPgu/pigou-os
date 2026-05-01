import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getLogs } from '@/lib/data';
import { createLog, updateLog } from '@/lib/log-store';
import { localDate } from '@/lib/brain-analysis';
import { StorageConfigurationError } from '@/lib/storage-guard';

function splitList(input: unknown) {
  if (Array.isArray(input)) return input.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof input !== 'string') return [];
  return input.split(/[\n,，|]/).map(item => item.trim()).filter(Boolean);
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!title || !content) return NextResponse.json({ ok: false, message: 'Title and content are required.' }, { status: 400 });

  try {
    const log = await createLog({
      title,
      content,
      date: typeof body?.date === 'string' && body.date.trim() ? body.date.trim() : localDate(),
      tags: splitList(body?.tags)
    });
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const current = getLogs().find(log => log.slug === slug);
  if (!current) return NextResponse.json({ ok: false, message: 'Log not found.' }, { status: 404 });

  try {
    const log = await updateLog({
      ...current,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : current.title,
      content: typeof body?.content === 'string' && body.content.trim() ? body.content.trim() : current.content,
      date: typeof body?.date === 'string' && body.date.trim() ? body.date.trim() : current.date,
      tags: splitList(body?.tags).length ? splitList(body.tags) : current.tags
    });
    return NextResponse.json({ ok: true, log });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}
