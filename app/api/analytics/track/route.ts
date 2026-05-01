import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { recordPageview } from '@/lib/analytics-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    await recordPageview({
      request,
      path: body?.path,
      title: body?.title,
      referrer: body?.referrer,
      isOwner: isAuthenticatedRequest(request)
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 202 });
    }
    throw error;
  }
}
