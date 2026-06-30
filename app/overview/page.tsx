import { ButtonLink, ItemLink, Label, MiniMeter, Panel, SectionHeader, SegmentedProgress, Stat, StatusBadge } from '@/components/UI';
import { ContributionHeatmap } from '@/components/activity/ContributionHeatmap';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { getAllTasks, getContributionActivity, getIdeas, getKnowledge, getLogs, getProjects, getProjectWikis, getSyncJobs, getTasks } from '@/lib/data';
import { sortProjectsByActivity } from '@/lib/project-activity';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Private Console',
  description: 'Login only.',
};

export default async function Home() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="Private Console" />;
  const projects = getProjects();
  const ideas = getIdeas();
  const logs = getLogs();
  const knowledge = getKnowledge();
  const tasks = getAllTasks();
  const taskRecords = getTasks();
  const activeProjects = sortProjectsByActivity({ projects, wikis: getProjectWikis(), tasks: taskRecords, logs });
  const rankedProjects = activeProjects.map(item => item.project);
  const hottestProject = activeProjects.find(item => item.project.status !== 'archived');
  const contribution = getContributionActivity();
  const syncJobs = getSyncJobs();
  const building = rankedProjects.filter(p => p.status === 'building');
  const active = building.length;
  const shipped = projects.filter(p => p.status === 'shipped').length;
  const stalled = projects.filter(p => p.status === 'paused').length;
  const linkedKnowledge = knowledge.filter(note => note.status === 'linked').length;
  const topIdea = [...ideas].sort((a, b) => b.score - a.score)[0];

  return <div className="grid gap-5">
    <section className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
      <Panel dark className="console-screen relative min-h-[430px] overflow-hidden p-6 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="scanline" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Overview / Signal</Label>
            <span className="live-pill mono hidden rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55 sm:inline-flex">Live snapshot</span>
          </div>
          <div>
            <h2 className="hero-title max-w-[9ch] text-5xl font-semibold leading-[.92] text-white sm:max-w-3xl sm:text-6xl md:text-8xl">Brain Console</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-t border-white/15 pt-4">
              <div className="caption text-white/40">NOW BUILDING</div>
              <div className="mt-2 text-2xl font-semibold text-white">{hottestProject?.project.title ?? 'No active project'}</div>
              {hottestProject && <div className="caption mt-2 text-white/45">信号 {hottestProject.score} / {hottestProject.reason}</div>}
            </div>
            <div className="border-t border-white/15 pt-4">
              <div className="caption text-white/40">LATEST SIGNAL</div>
              <div className="mt-2 text-sm leading-6 text-white/70">{knowledge[0]?.title ?? tasks[0]?.task ?? 'Quiet'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5">
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Stat value={active} label="推进中项目" />
          <Stat value={knowledge.length} label="知识笔记" />
          <Stat value={ideas.length} label="想法信号" />
          <Stat value={shipped} label="已发布" />
        </section>
        <Panel raised className="p-5">
          <SectionHeader label="Pulse" value="work / memory" />
          <div className="grid gap-4">
            <MiniMeter label="活跃占比" value={projects.length ? Math.round((active / projects.length) * 100) : 0} />
            <MiniMeter label="知识关联" value={knowledge.length ? Math.round((linkedKnowledge / knowledge.length) * 100) : 0} />
            <MiniMeter label="行动队列" value={Math.min(100, tasks.length * 8)} />
          </div>
        </Panel>
      </div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Building" value={String(building.length)} />
        <div>
          {activeProjects.filter(item => item.project.status === 'building').map(({ project: p, score, reason }) => <ItemLink key={p.slug} href={`/projects/${p.slug}`} title={p.title} meta={<StatusBadge status={p.status} />}>
            <span>{p.summary}</span>
            <div className="mt-5"><SegmentedProgress value={p.progress} /></div>
            <div className="caption mt-3">信号 {score} / {reason}</div>
          </ItemLink>)}
        </div>
      </Panel>
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Queue" value="priority" />
        <ol className="space-y-4">
          {tasks.slice(0, 7).map((t, i) => <li key={`${t.slug}-${t.index}`} className="grid grid-cols-[42px_1fr] gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
            <span className="doto text-3xl leading-none text-[var(--text-disabled)]">{String(i + 1).padStart(2,'0')}</span>
            <span className="text-sm leading-6 text-[var(--text-primary)]">{t.task}<span className="caption ml-2">/{t.project}</span></span>
          </li>)}
        </ol>
      </Panel>
    </section>

    <Panel className="p-5 md:p-6">
      <SectionHeader label="Heatmap" value={contribution.owner} />
      <ContributionHeatmap days={contribution.days} total={contribution.totalContributions} />
    </Panel>

    <SyncStatus jobs={syncJobs} compact />

    <section className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Knowledge" value={`${linkedKnowledge}/${knowledge.length}`} />
        <div>{knowledge.slice(0, 4).map(note => <ItemLink key={note.slug} href="/knowledge" title={note.title} meta={<StatusBadge status={note.status} />}>{note.summary}</ItemLink>)}</div>
      </Panel>
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Ideas" value="score / 100" />
        <div>{ideas.map(i => <ItemLink key={i.slug} href="/ideas" title={i.title} meta={<span className="doto text-3xl text-[var(--ink)]">{i.score}</span>}>{i.summary}</ItemLink>)}</div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-2">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Log" value={logs[0]?.date} />
        <div>{logs.slice(0, 3).map(l => <ItemLink key={l.slug} href="/log" title={l.title} meta={<span className="caption">{l.date}</span>}>{l.content}</ItemLink>)}</div>
      </Panel>
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Cold" value={String(stalled)} />
        <div className="space-y-4">
          <MiniMeter label="最高想法信号" value={topIdea?.score ?? 0} />
        </div>
      </Panel>
    </section>

    <div className="flex flex-wrap gap-3">
      <ButtonLink primary href="/today">打开 Today</ButtonLink>
      <ButtonLink href="/inbox">快速投喂</ButtonLink>
      <ButtonLink href="/weekly">看周报</ButtonLink>
      <ButtonLink href="/work">公开作品</ButtonLink>
    </div>
  </div>;
}
