import Link from 'next/link';
import { cookies } from 'next/headers';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import { TodayLogButton } from '@/components/TodayDailyFlow';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { generateTodayCockpit, type TodayCockpitProject, type TodayCockpitTask } from '@/lib/today-cockpit';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  const cockpit = generateTodayCockpit({ isLoggedIn });

  return <div className="grid gap-5">
    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <Panel dark className="console-screen relative min-h-[440px] overflow-hidden p-6 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="scanline" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Today / Generated Daily Cockpit</Label>
            <span className="live-pill mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55">{cockpit.today}</span>
          </div>

          <div>
            <h1 className="hero-title max-w-[9ch] text-5xl font-semibold leading-[.92] text-white sm:max-w-3xl sm:text-6xl md:text-8xl">Today</h1>
            <div className="mt-6 max-w-3xl border-y border-white/15 py-5">
              <div className="caption text-white/40">MAIN LINE</div>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-white md:text-4xl">{cockpit.mainLine.title}</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <DarkReadout label="Open" value={cockpit.stats.openTasks} detail="tasks" />
            <DarkReadout label="Done" value={cockpit.stats.doneYesterday} detail="yesterday" />
            <DarkReadout label="Hot" value={cockpit.stats.hotProjects} detail="projects" />
            <DarkReadout label="Cold" value={cockpit.stats.coldProjects} detail="projects" />
          </div>

          {isLoggedIn && <TodayLogButton draft={cockpit.logDraft} />}
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="今日主线 / Main Line" value={cockpit.mainLine.reason} />
        <div className="grid gap-5">
          <div>
            <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{cockpit.mainLine.title}</h3>
          </div>
          <Link href={cockpit.mainLine.href} className="mono inline-flex min-h-10 w-fit items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">
            {cockpit.mainLine.source}
          </Link>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.86fr_1.14fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Yesterday Done" value={cockpit.yesterday} />
        <Link href={cockpit.yesterdayDone.href} className="block transition hover:bg-[var(--surface-soft)]/55 md:-mx-3 md:px-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{cockpit.yesterdayDone.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{cockpit.yesterdayDone.summary}</p>
            </div>
            <span className="doto text-6xl leading-none text-[var(--ink)]">{String(cockpit.yesterdayDone.count).padStart(2, '0')}</span>
          </div>
        </Link>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Scope Guard" value="not today" />
        <Link href={cockpit.notToday.href} className="block transition hover:bg-[var(--surface-soft)]/55 md:-mx-3 md:px-3">
          <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{cockpit.notToday.title}</h3>
        </Link>
      </Panel>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Hot Projects" value={String(cockpit.hotProjects.length)} />
        <ProjectList projects={cockpit.hotProjects} empty="No hot project found" />
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Cold Projects" value={String(cockpit.coldProjects.length)} />
        <ProjectList projects={cockpit.coldProjects} empty="No cold project found" />
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Idea Worth Continuing" value={`${cockpit.idea.score}/100`} />
        <Link href={cockpit.idea.href} className="block transition hover:bg-[var(--surface-soft)]/55 md:-mx-3 md:px-3">
          <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{cockpit.idea.title}</h3>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{cockpit.idea.summary}</p>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <div className="caption">next</div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">{cockpit.idea.next}</p>
            {cockpit.idea.linkedProject && <div className="caption mt-3">linked project / {cockpit.idea.linkedProject}</div>}
          </div>
        </Link>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Execution Queue" value={`${cockpit.queue.length} visible task(s)`} />
        <div className="grid gap-4">
          {cockpit.queue.map((task, index) => <TaskRow key={task.slug} task={task} index={index} />)}
          {!cockpit.queue.length && <EmptyState title="No open tasks" />}
        </div>
      </Panel>
    </section>

    <div className="flex flex-wrap gap-3">
      <ButtonLink primary href={cockpit.mainLine.href}>Open main line</ButtonLink>
      <ButtonLink href="/tasks">Tasks</ButtonLink>
      <ButtonLink href="/projects">Projects</ButtonLink>
      <ButtonLink href="/ideas">Ideas</ButtonLink>
    </div>
  </div>;
}

function ProjectList({ projects, empty }: { projects: TodayCockpitProject[]; empty: string }) {
  return <div>
    {projects.map(project => <Link key={project.slug} href={project.href} className="block border-b border-[var(--border)] py-4 transition last:border-b-0 hover:bg-[var(--surface-soft)]/55 md:px-3 md:hover:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={project.priority} />
          <StatusBadge status={project.status} />
        </div>
        <span className="caption">{project.healthLabel} / {project.healthScore}</span>
      </div>
      <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{project.summary}</p>
    </Link>)}
    {!projects.length && <EmptyState title={empty} />}
  </div>;
}

function TaskRow({ task, index }: { task: TodayCockpitTask; index: number }) {
  return <Link href={task.href} className="grid gap-4 border-b border-[var(--border)] pb-4 transition last:border-b-0 hover:bg-[var(--surface-soft)]/55 md:grid-cols-[54px_1fr] md:px-3">
    <div className="doto text-5xl leading-none text-[var(--text-disabled)]">{String(index + 1).padStart(2, '0')}</div>
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="mono rounded-full border border-[var(--ink)] px-3 py-1 text-[10px] uppercase text-[var(--ink)]">{task.priority}</span>
        <span className="mono rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] uppercase text-[var(--text-secondary)]">{task.status}</span>
        <span className="caption">{task.projectTitle || task.updated}</span>
      </div>
      <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{task.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{task.summary}</p>
    </div>
  </Link>;
}

function DarkReadout({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="border-t border-white/15 pt-4">
    <div className="caption text-white/40">{label}</div>
    <div className="mt-2 flex items-end gap-2">
      <span className="doto text-5xl leading-none text-white md:text-6xl">{String(value).padStart(2, '0')}</span>
      <span className="caption mb-2 text-white/45">{detail}</span>
    </div>
  </div>;
}

function EmptyState({ title }: { title: string }) {
  return <div className="border border-dashed border-[var(--border-visible)] bg-white/35 p-4">
    <div className="mono text-[10px] uppercase text-[var(--text-primary)]">{title}</div>
  </div>;
}
