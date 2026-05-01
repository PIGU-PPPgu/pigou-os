import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getSyncJobs } from '@/lib/data';
import { enqueueSyncJob } from '@/lib/sync-jobs';
import { StorageConfigurationError } from '@/lib/storage-guard';

export async function GET(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, jobs: getSyncJobs().slice(0, 50) });
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (body?.type === 'llm-wiki' || body?.event === 'rebuild-llm-wiki') {
    try {
      const job = await enqueueSyncJob({
        source: 'manual',
        repo: {
          owner: 'local',
          name: 'llm-wiki',
          fullName: 'local/llm-wiki',
          url: '/llm-wiki',
          private: true
        },
        projectSlug: 'pigou-os',
        event: 'rebuild-llm-wiki',
        summary: 'Manual LLM Wiki rebuild requested'
      });
      return NextResponse.json({ ok: true, job });
    } catch (error) {
      if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
      throw error;
    }
  }

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const [owner, name] = fullName.split('/');
  if (!owner || !name) {
    return NextResponse.json({ ok: false, message: 'Repo fullName must look like owner/repo.' }, { status: 400 });
  }

  try {
    const job = await enqueueSyncJob({
      source: 'manual',
      repo: {
        owner,
        name,
        fullName,
        url: `https://github.com/${owner}/${name}`,
        private: Boolean(body?.private)
      },
      projectSlug: typeof body?.projectSlug === 'string' && body.projectSlug.trim() ? body.projectSlug.trim() : name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, ''),
      event: 'manual-sync',
      withLlm: Boolean(body?.withLlm),
      warmDeepWiki: body?.warmDeepWiki !== false,
      summary: `Manual sync requested for ${fullName}`
    });
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}
