'use client';

import { FormEvent, useState } from 'react';
import type { SyncJob } from '@/lib/data';
import { Panel, SectionHeader } from '@/components/UI';
import { AuthOnly } from '@/components/auth/AuthControls';

const label: Record<SyncJob['status'], string> = {
  queued: '排队',
  running: '运行中',
  success: '成功',
  failed: '失败',
  'needs-review': '需检查'
};

const tone: Record<SyncJob['status'], string> = {
  queued: 'text-[var(--text-disabled)]',
  running: 'text-[var(--accent)]',
  success: 'text-[var(--success)]',
  failed: 'text-[var(--danger)]',
  'needs-review': 'text-[var(--warning)]'
};

export function SyncStatus({ jobs, compact = false }: { jobs: SyncJob[]; compact?: boolean }) {
  const [localJobs, setLocalJobs] = useState(jobs);
  const [message, setMessage] = useState('ready');
  const latest = localJobs[0];
  const pending = localJobs.filter(job => job.status === 'queued' || job.status === 'running').length;
  const review = localJobs.filter(job => job.status === 'failed' || job.status === 'needs-review').length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('queueing sync');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/sync/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        fullName: form.get('fullName'),
        projectSlug: form.get('projectSlug'),
        withLlm: form.get('withLlm') === 'on',
        warmDeepWiki: true
      })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setLocalJobs(current => [result.job, ...current]);
      setMessage(`queued: ${result.job.repo.fullName}`);
      event.currentTarget.reset();
    } else {
      setMessage(result?.message || 'queue failed');
    }
  }

  return <Panel className="p-5 md:p-6">
    <SectionHeader label="自动同步" value={latest ? latest.requestedAt.slice(0, 10) : '暂无 job'} />
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div><div className="doto text-5xl leading-none text-[var(--ink)]">{localJobs.length}</div><div className="caption mt-1">jobs</div></div>
        <div><div className="doto text-5xl leading-none text-[var(--ink)]">{pending}</div><div className="caption mt-1">pending</div></div>
        <div><div className="doto text-5xl leading-none text-[var(--ink)]">{review}</div><div className="caption mt-1">review</div></div>
      </div>
      {!compact && <div className="grid gap-2">
        {localJobs.slice(0, 5).map(job => <div key={job.id} className="grid gap-1 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="mono text-[11px] text-[var(--ink)]">{job.repo.fullName}</span>
            <span className={`mono rounded-full border border-[var(--border-visible)] px-2 py-1 text-[9px] uppercase ${tone[job.status]}`}>{label[job.status]}</span>
          </div>
          {(job.summary || job.error || job.event) && <p className="text-xs leading-5 text-[var(--text-secondary)]">{job.summary || job.error || job.event}</p>}
        </div>)}
      </div>}
      {!localJobs.length && <div className="caption">no sync jobs</div>}
      {!compact && <AuthOnly>
        <form onSubmit={submit} className="grid gap-3 rounded-[8px] border border-[var(--border)] bg-white/35 p-3">
          <div className="caption">Manual sync job</div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="fullName" required className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" placeholder="owner/repo" />
            <input name="projectSlug" className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" placeholder="project slug optional" />
            <label className="mono inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase"><input type="checkbox" name="withLlm" /> LLM</label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">queue sync</button>
            <span className="caption">{message}</span>
          </div>
        </form>
      </AuthOnly>}
    </div>
  </Panel>;
}
