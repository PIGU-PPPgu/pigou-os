import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { summarizeAnalytics } from '@/lib/analytics-store';
import { Label, Panel, SectionHeader, Stat } from '@/components/UI';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { getSyncJobs } from '@/lib/data';

export const dynamic = 'force-dynamic';

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default async function OpsPage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  if (!isLoggedIn) {
    return <div className="grid gap-5">
      <Panel dark className="console-screen min-h-[420px] p-6 md:p-8">
        <Label>Hidden Ops</Label>
        <h2 className="mt-8 max-w-[8ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">LOCK</h2>
        <Link href="/login" className="mono mt-8 inline-flex min-h-10 w-fit items-center rounded-full border border-white/40 px-4 text-[10px] uppercase text-white">login</Link>
      </Panel>
    </div>;
  }

  const summary = summarizeAnalytics();
  const maxDaily = Math.max(1, ...summary.daily.map(day => day.views));
  const syncJobs = getSyncJobs();

  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Label>Hidden Ops / Analytics</Label>
          <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">Admin Dashboard</h2>
        </div>
        <div className="caption">generated / {formatTime(summary.generatedAt)}</div>
      </div>
    </Panel>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Stat value={summary.totalPageviews} label="公开浏览量" />
      <Stat value={summary.visitorCount} label="公开访客" />
      <Stat value={summary.pageviews24h} label="24h 浏览" />
      <Stat value={summary.visitors7d} label="7d 访客" />
    </section>

    <section className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
      <SyncStatus jobs={syncJobs} />
      <Panel className="p-5 md:p-6">
        <SectionHeader label="GitHub Sync Readiness" value="private ops" />
        <div className="grid gap-4">
          <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
            <div className="caption mb-2">Webhook URL</div>
            <code className="break-all text-sm leading-6 text-[var(--ink)]">https://pigou-os.intellicode.top/api/github/webhook</code>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
              <div className="caption">full scan</div>
              <div className="mt-2 text-lg font-semibold text-[var(--ink)]">hourly</div>
            </div>
            <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
              <div className="caption">queue</div>
              <div className="mt-2 text-lg font-semibold text-[var(--ink)]">5 min</div>
            </div>
            <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
              <div className="caption">privacy</div>
              <div className="mt-2 text-lg font-semibold text-[var(--ink)]">guarded</div>
            </div>
          </div>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="14 日趋势" value={`${summary.pageviews7d} views / 7d`} />
        <div className="flex h-44 items-end gap-2 border-b border-[var(--border)] pb-3">
          {summary.daily.map(day => <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-t-[4px] bg-[var(--ink)] transition" style={{ height: `${Math.max(4, (day.views / maxDaily) * 150)}px`, opacity: day.views ? 1 : .12 }} />
            <span className="caption max-w-full truncate text-[9px]">{day.date.slice(5)}</span>
          </div>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="设备" value="public only" />
        <div className="grid gap-3">
          {summary.devices.map(device => <div key={device.device}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="caption">{device.device}</span>
              <span className="caption text-[var(--text-primary)]">{device.views}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (device.views / Math.max(1, summary.totalPageviews)) * 100)}%` }} /></div>
          </div>)}
          {!summary.devices.length && <p className="text-sm leading-6 text-[var(--text-secondary)]">还没有公开访客数据。</p>}
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="热门页面" value="top paths" />
        <div className="grid gap-2">
          {summary.topPages.map(page => <div key={page.path} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--border)] py-3 last:border-b-0">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">{page.path}</div>
              <div className="caption mt-1">{page.visitors} visitor(s)</div>
            </div>
            <div className="doto text-3xl leading-none text-[var(--ink)]">{page.views}</div>
          </div>)}
          {!summary.topPages.length && <p className="text-sm leading-6 text-[var(--text-secondary)]">还没有页面浏览记录。</p>}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="来源" value="referrers" />
        <div className="grid gap-2">
          {summary.referrers.map(item => <div key={item.referrer} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--border)] py-3 last:border-b-0">
            <span className="truncate text-sm text-[var(--ink)]">{item.referrer}</span>
            <span className="caption text-[var(--text-primary)]">{item.views}</span>
          </div>)}
          {!summary.referrers.length && <p className="text-sm leading-6 text-[var(--text-secondary)]">还没有来源数据。</p>}
        </div>
      </Panel>
    </section>

    <Panel className="p-5 md:p-6">
      <SectionHeader label="最近访问" value={`${summary.publicPageviews} public / ${summary.ownerPageviews} owner ignored`} />
      <div className="grid gap-2">
        {summary.recent.map(event => <div key={event.id} className="grid gap-2 border-b border-[var(--border)] py-3 last:border-b-0 md:grid-cols-[110px_1fr_120px] md:items-center">
          <div className="caption">{formatTime(event.createdAt)}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--ink)]">{event.path}</div>
            <div className="caption mt-1">{event.referrer || 'direct'}</div>
          </div>
          <div className="caption md:text-right">{event.device}</div>
        </div>)}
        {!summary.recent.length && <p className="text-sm leading-6 text-[var(--text-secondary)]">还没有最近访问。</p>}
      </div>
    </Panel>
  </div>;
}
