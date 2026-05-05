import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { ButtonLink, Label, Panel, SectionHeader } from '@/components/UI';
import { getUpdates } from '@/lib/data';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const typeLabels: Record<string, string> = {
  release: 'release',
  deploy: 'deploy',
  design: 'design',
  sync: 'sync',
  ops: 'ops'
};

const statusLabels: Record<string, string> = {
  shipped: 'shipped',
  internal: 'internal',
  planned: 'planned'
};

function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`mono inline-flex min-h-7 items-center rounded-full border px-3 text-[10px] uppercase ${active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-visible)] text-[var(--text-secondary)]'}`}>{children}</span>;
}

export default async function UpdatesPage() {
  const updates = getUpdates();
  const latest = updates[0];
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));

  return <div className="grid gap-5">
    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Panel dark className="console-screen relative min-h-[380px] overflow-hidden p-6 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="scanline" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Updates / Changelog</Label>
            {latest && <span className="mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55">{latest.version}</span>}
          </div>
          <div>
            <h2 className="max-w-[9ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">Version Log</h2>
          </div>
          {latest && <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-t border-white/15 pt-4">
              <div className="caption text-white/40">LATEST</div>
              <div className="mt-2 text-2xl font-semibold text-white">{latest.title}</div>
              <div className="caption mt-2 text-white/45">{latest.date}</div>
            </div>
            <div className="border-t border-white/15 pt-4">
              <div className="caption text-white/40">STATUS</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/70">{latest.type}</span>
                <span className="mono rounded-full border border-[var(--accent)] px-3 py-1 text-[10px] uppercase text-[var(--accent)]">{latest.status}</span>
              </div>
            </div>
          </div>}
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Ops Route" value={isLoggedIn ? 'unlocked' : 'login required'} />
        <div className="grid gap-5">
          <div>
            <div className="doto text-6xl font-black leading-none text-[var(--ink)]">/ops</div>
            <div className="caption mt-3">pageviews / visitors / referrers / devices / recent visits</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={isLoggedIn}>analytics</Chip>
            <Chip>hidden</Chip>
            <Chip>private</Chip>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink primary href="/ops">打开后台统计</ButtonLink>
            {!isLoggedIn && <ButtonLink href="/login">登录</ButtonLink>}
          </div>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Release Counter" value={`${updates.length} entries`} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="doto text-6xl font-black leading-none text-[var(--ink)]">{updates.length}</div>
            <div className="caption mt-2">updates</div>
          </div>
          <div>
            <div className="doto text-6xl font-black leading-none text-[var(--ink)]">{updates.filter(update => update.status === 'shipped').length}</div>
            <div className="caption mt-2">shipped</div>
          </div>
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Update Stream" value={latest?.date} />
        <div>
          {updates.map(update => <article key={update.slug} className="border-b border-[var(--border)] py-6 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Chip active>{update.version}</Chip>
                  <Chip>{typeLabels[update.type] ?? update.type}</Chip>
                  <Chip>{statusLabels[update.status] ?? update.status}</Chip>
                </div>
                <h3 className="mt-4 text-3xl font-semibold leading-tight text-[var(--ink)]">{update.title}</h3>
              </div>
              <span className="caption">{update.date}</span>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--text-secondary)]">{update.summary}</p>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
              <ol className="space-y-3">
                {update.highlights.map((item, index) => <li key={item} className="grid grid-cols-[32px_1fr] gap-3">
                  <span className="doto text-2xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
                  <span className="text-sm leading-6 text-[var(--text-primary)]">{item}</span>
                </li>)}
              </ol>
              {update.commits?.length ? <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
                <div className="caption mb-3">commits</div>
                <div className="grid gap-3">
                  {update.commits.map(commit => <div key={commit.hash} className="grid grid-cols-[72px_1fr] gap-3 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
                    <span className="mono text-[10px] uppercase text-[var(--ink)]">{commit.hash}</span>
                    <span className="text-sm leading-5 text-[var(--text-secondary)]">{commit.title}</span>
                  </div>)}
                </div>
              </div> : null}
            </div>
          </article>)}
        </div>
      </Panel>
    </section>

    <div className="flex flex-wrap gap-3">
      <ButtonLink href="/">Today</ButtonLink>
      <ButtonLink href="/llm-wiki">LLM Wiki</ButtonLink>
      <ButtonLink href="/ops">Ops</ButtonLink>
    </div>
  </div>;
}
