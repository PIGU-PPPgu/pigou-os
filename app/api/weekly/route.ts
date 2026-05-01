import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { buildSyncStrategy } from '@/lib/sync-strategy';
import { generateWeeklyBrief } from '@/lib/weekly-brief';

export const runtime = 'nodejs';

function daysFromUrl(request: Request) {
  const value = new URL(request.url).searchParams.get('days');
  const days = Number(value || 7);
  return Number.isFinite(days) ? Math.max(1, Math.min(31, Math.round(days))) : 7;
}

export async function GET(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const brief = await generateWeeklyBrief({ days: daysFromUrl(request), withLlm: false });
  return NextResponse.json({ ok: true, brief, strategy: buildSyncStrategy() });
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const days = Number(body?.days || 7);
  const brief = await generateWeeklyBrief({
    days: Number.isFinite(days) ? Math.max(1, Math.min(31, Math.round(days))) : 7,
    withLlm: Boolean(body?.withLlm)
  });
  return NextResponse.json({ ok: true, brief, strategy: buildSyncStrategy() });
}
