import type { OpsStatusSnapshot, OpsTone } from '@/lib/ops-status';
import { Label, Panel, SectionHeader } from '@/components/UI';

const toneClass: Record<OpsTone, string> = {
  ok: 'text-[var(--success)]',
  warn: 'text-[var(--warning)]',
  bad: 'text-[var(--danger)]',
  idle: 'text-[var(--text-disabled)]'
};

const toneLabel: Record<OpsTone, string> = {
  ok: 'ok',
  warn: 'watch',
  bad: 'review',
  idle: 'idle'
};

function formatTime(value?: string) {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function HealthCard({ item }: { item: OpsStatusSnapshot['worker'] }) {
  return <Panel className="min-h-44 p-5">
    <div className="flex items-start justify-between gap-4">
      <Label>{item.label}</Label>
      <span className={`mono inline-flex items-center gap-2 rounded-full border border-[var(--border-visible)] bg-white/55 px-3 py-1 text-[9px] uppercase ${toneClass[item.tone]}`}>
        <span className="status-light h-1.5 w-1.5 rounded-full bg-current" />
        {toneLabel[item.tone]}
      </span>
    </div>
    <div className="mt-5 min-w-0 text-3xl font-semibold leading-tight text-[var(--ink)]">{item.value}</div>
    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-secondary)]">{item.detail}</p>
    <div className="caption mt-4">{formatTime(item.at)}</div>
  </Panel>;
}

function DeployCard({ status }: { status: OpsStatusSnapshot }) {
  const deployTone: OpsTone = status.deploy.status === 'failed' ? 'bad' : status.deploy.status === 'running' ? 'warn' : 'ok';
  return <Panel dark className="console-screen min-h-44 overflow-hidden p-5">
    <div className="scanline" />
    <div className="relative">
      <div className="flex items-start justify-between gap-4">
        <Label>Deploy</Label>
        <span className={`mono inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[9px] uppercase ${toneClass[deployTone]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.deploy.status || status.deploy.source}
        </span>
      </div>
      <div className="doto mt-5 break-all text-5xl font-black leading-none text-white">{status.deploy.commit}</div>
      <div className="mt-4 grid gap-2 text-sm leading-6 text-white/70">
        <div className="mono text-[11px] uppercase">{status.deploy.branch || 'branch unknown'}</div>
        <div className="caption">{formatTime(status.deploy.deployedAt)}</div>
        {status.deploy.previousCommit && <div className="caption">from {status.deploy.previousCommit}</div>}
        {status.deploy.error && <div className="text-xs leading-5 text-[var(--danger)]">{status.deploy.error}</div>}
      </div>
    </div>
  </Panel>;
}

export function OpsHealthPanel({ status }: { status: OpsStatusSnapshot }) {
  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Label>Hidden Ops / Health</Label>
          <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">Status Panel</h2>
        </div>
        <div className="caption">checked / {formatTime(status.generatedAt)}</div>
      </div>
    </Panel>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DeployCard status={status} />
      <HealthCard item={status.worker} />
      <HealthCard item={status.lastSyncJob} />
      <HealthCard item={status.lastLlmWikiRebuild} />
    </section>

    <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Content Write" value={status.lastContentWrite.path || 'content'} />
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="caption">latest local source</div>
              <div className="mt-2 break-all text-2xl font-semibold leading-tight text-[var(--ink)]">{status.lastContentWrite.value}</div>
            </div>
            <span className={`mono rounded-full border border-[var(--border-visible)] bg-white/50 px-3 py-1 text-[10px] uppercase ${toneClass[status.lastContentWrite.tone]}`}>{toneLabel[status.lastContentWrite.tone]}</span>
          </div>
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{status.lastContentWrite.detail}</p>
          <div className="caption">{formatTime(status.lastContentWrite.at)}</div>
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Recent Errors" value={`${status.counters.reviewJobs} job(s) need review`} />
        <div className="grid gap-2">
          {status.recentErrors.map(error => <div key={`${error.detail}-${error.at}`} className="grid gap-2 border-b border-[var(--border)] py-3 last:border-b-0 md:grid-cols-[130px_1fr]">
            <div className="caption">{formatTime(error.at)}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">{error.source}</div>
              <p className="mt-1 text-xs leading-5 text-[var(--danger)]">{error.message}</p>
            </div>
          </div>)}
          {!status.recentErrors.length && <p className="text-sm leading-6 text-[var(--text-secondary)]">No failed sync jobs or review states in recent job files.</p>}
        </div>
      </Panel>
    </section>
  </div>;
}
