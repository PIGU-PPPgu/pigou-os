import { NextResponse } from 'next/server';
import { enqueueSyncJob, verifyGitHubSignature } from '@/lib/sync-jobs';
import { StorageConfigurationError } from '@/lib/storage-guard';

export const runtime = 'nodejs';

function projectSlugFromRepo(repoName: string) {
  return repoName.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyGitHubSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, message: 'Invalid GitHub signature.' }, { status: 401 });
  }

  const event = request.headers.get('x-github-event') || 'unknown';
  let payload: { repository?: { owner?: { login?: string }; name?: string; full_name?: string; html_url?: string; private?: boolean }; ref?: string; before?: string; after?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload.' }, { status: 400 });
  }
  const repo = payload.repository;
  if (!repo?.owner?.login || !repo?.name || !repo?.full_name) {
    return NextResponse.json({ ok: false, message: 'Missing repository payload.' }, { status: 400 });
  }

  try {
    const job = await enqueueSyncJob({
      source: 'github-webhook',
      repo: {
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        private: Boolean(repo.private)
      },
      projectSlug: projectSlugFromRepo(repo.name),
      event,
      ref: payload.ref,
      before: payload.before,
      after: payload.after,
      withLlm: process.env.PIGOU_SYNC_WITH_LLM === 'true',
      warmDeepWiki: process.env.PIGOU_SYNC_WARM_DEEPWIKI !== 'false',
      summary: `${event} received for ${repo.full_name}`
    });
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
