import Link from 'next/link';
import { cookies } from 'next/headers';
import { Label, Panel, SectionHeader, Stat, StatusBadge } from '@/components/UI';
import { SyncStrategyPanel } from '@/components/sync/SyncStrategyPanel';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { buildSyncStrategy } from '@/lib/sync-strategy';
import { generateWeeklyBrief, type WeeklyBriefItem } from '@/lib/weekly-brief';

export const dynamic = 'force-dynamic';

const sourceLabel: Record<WeeklyBriefItem['source'], string> = {
  projects: 'project',
  tasks: 'task',
  knowledge: 'knowledge',
  ideas: 'idea',
  logs: 'log',
  sync: 'sync'
};

const sourceHref: Record<WeeklyBriefItem['source'], string> = {
  projects: '/projects',
  tasks: '/tasks',
  knowledge: '/knowledge',
  ideas: '/ideas',
  logs: '/log',
  sync: '/projects'
};

function LockScreen() {
  return <div className="grid gap-5">
    <Panel dark className="console-screen min-h-[430px] p-6 md:p-8">
      <Label>Weekly Brief / Internal</Label>
      <h2 className="mt-8 max-w-[8ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">LOCK</h2>
      <Link href="/login" className="mono mt-8 inline-flex min-h-10 w-fit items-center rounded-full border border-white/40 px-4 text-[10px] uppercase text-white">login</Link>
    </Panel>
  </div>;
}

export default async function WeeklyPage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  if (!isLoggedIn) return <LockScreen />;

  const [brief, strategy] = await Promise.all([
    generateWeeklyBrief({ days: 7, withLlm: false }),
    Promise.resolve(buildSyncStrategy())
  ]);

  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Label>Weekly Brief / {brief.range.start} - {brief.range.end}</Label>
          <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">Internal Weekly Brief</h2>
        </div>
        <div className="text-left lg:text-right">
          <div className="doto text-7xl leading-none text-[var(--ink)]">{brief.synthesis.focusScore}</div>
          <div className="caption mt-2">focus score / {brief.synthesis.source}</div>
        </div>
      </div>
    </Panel>

    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <Stat value={brief.stats.activeProjects} label="active projects" />
      <Stat value={brief.stats.openTasks} label="open tasks" />
      <Stat value={brief.stats.knowledge} label="weekly knowledge" />
      <Stat value={brief.stats.syncNeedsReview} label="sync review" />
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Synthesis" value={brief.synthesis.model} />
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <div className="caption mb-3">Wins</div>
            <ul className="grid gap-3">
              {brief.synthesis.wins.map(item => <li key={item} className="text-sm leading-6 text-[var(--text-primary)]">{item}</li>)}
            </ul>
          </div>
          <div>
            <div className="caption mb-3">Risks</div>
            <ul className="grid gap-3">
              {brief.synthesis.risks.map(item => <li key={item} className="text-sm leading-6 text-[var(--text-primary)]">{item}</li>)}
            </ul>
          </div>
          <div>
            <div className="caption mb-3">Next</div>
            <ul className="grid gap-3">
              {brief.synthesis.nextActions.map(item => <li key={item} className="text-sm leading-6 text-[var(--text-primary)]">{item}</li>)}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Questions" value={`${brief.synthesis.questions.length} prompts`} />
        <ol className="grid gap-4">
          {brief.synthesis.questions.map((question, index) => <li key={question} className="grid grid-cols-[42px_1fr] gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
            <span className="doto text-3xl leading-none text-[var(--text-disabled)]">{String(index + 1).padStart(2, '0')}</span>
            <span className="text-sm leading-6 text-[var(--text-primary)]">{question}</span>
          </li>)}
        </ol>
      </Panel>
    </section>

    <Panel className="p-5 md:p-6">
      <SectionHeader label="Weekly Highlights" value={`${brief.highlights.length} signals`} />
      <div className="grid gap-2">
        {brief.highlights.map(item => <Link key={`${item.source}-${item.slug || item.title}`} href={sourceHref[item.source]} className="grid gap-2 border-b border-[var(--border)] py-4 transition last:border-b-0 hover:bg-[var(--surface-soft)]/55 md:grid-cols-[120px_1fr_auto] md:items-start md:px-3">
          <div className="caption">{sourceLabel[item.source]}{item.date ? ` / ${item.date.slice(0, 10)}` : ''}</div>
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight text-[var(--ink)]">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.summary}</p>
          </div>
          <div className="doto text-4xl leading-none text-[var(--ink)] md:text-right">{item.score}</div>
        </Link>)}
      </div>
    </Panel>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Project Signals" value={`${brief.projectSignals.length} visible threads`} />
        <div className="grid gap-3">
          {brief.projectSignals.map(project => <Link key={project.slug} href={`/projects/${project.slug}`} className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4 transition hover:border-[var(--border-visible)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold leading-tight text-[var(--ink)]">{project.title}</div>
                <div className="caption mt-1">{project.priority} / updated {project.updated}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={project.status} /><span className="doto text-3xl leading-none text-[var(--ink)]">{project.progress}</span></div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{project.signal}</p>
            {project.nextActions.length > 0 && <div className="caption mt-3">{project.nextActions.join(' / ')}</div>}
          </Link>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Sync Signals" value={`${brief.syncSignals.length} latest jobs`} />
        <div className="grid gap-3">
          {brief.syncSignals.map(job => <div key={job.id} className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="mono text-[11px] text-[var(--ink)]">{job.repo}</div>
              <StatusBadge status={job.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{job.summary}</p>
            <div className="caption mt-2">{job.requestedAt.slice(0, 16)}</div>
          </div>)}
        </div>
      </Panel>
    </section>

    <SyncStrategyPanel strategy={strategy} />
  </div>;
}
