import { ButtonLink, ItemLink, Label, Panel, SegmentedProgress, Stat, StatusBadge } from '@/components/UI';
import { getAllTasks, getIdeas, getLogs, getProjects } from '@/lib/data';

export default function Home() {
  const projects = getProjects();
  const ideas = getIdeas();
  const logs = getLogs();
  const tasks = getAllTasks();
  const active = projects.filter(p => p.status === 'building').length;
  const stalled = projects.filter(p => p.status === 'paused').length;
  return <div className="grid gap-6">
    <Panel raised className="relative overflow-hidden p-6 md:p-8">
      <div className="absolute right-8 top-8 hidden h-36 w-36 rounded-full border border-[var(--border-visible)] md:block"><div className="absolute inset-5 rounded-full border border-[var(--border)] dot-grid opacity-50" /></div>
      <div className="max-w-3xl"><Label>Command Center / 2026</Label><h2 className="mt-5 text-4xl font-semibold leading-[.95] tracking-[-.075em] text-white md:text-7xl">Projects, ideas and next actions. One cockpit.</h2><p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)]">A personal operating system for tracking what Pigou is building, what is worth thinking about, and what needs to happen next.</p><div className="mt-7 flex flex-wrap gap-3"><ButtonLink primary href="/projects">Open Projects</ButtonLink><ButtonLink href="/ideas">Scan Ideas</ButtonLink></div></div>
    </Panel>
    <section className="grid gap-3 md:grid-cols-4"><Stat value={active} label="Active" /><Stat value={ideas.length} label="Ideas" /><Stat value={projects.filter(p => p.status === 'shipped').length} label="Shipped" /><Stat value={stalled} label="Stalled" /></section>
    <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <Panel className="p-5 md:p-6"><div className="mb-2 flex items-center justify-between"><Label>Now Building</Label><span className="caption">LIVE</span></div><div>{projects.filter(p => p.status === 'building').map(p => <ItemLink key={p.slug} href={`/projects/${p.slug}`} title={p.title} meta={<StatusBadge status={p.status} />}><span>{p.summary}</span><div className="mt-5"><SegmentedProgress value={p.progress} /></div></ItemLink>)}</div></Panel>
      <Panel raised className="p-5 md:p-6"><Label>Next Actions</Label><ol className="mt-5 space-y-4">{tasks.slice(0, 7).map((t, i) => <li key={`${t.slug}-${t.index}`} className="grid grid-cols-[34px_1fr] gap-3"><span className="doto text-2xl leading-none text-[var(--text-disabled)]">{String(i + 1).padStart(2,'0')}</span><span className="text-sm leading-6 text-[var(--text-primary)]">{t.task}<span className="caption ml-2">/{t.project}</span></span></li>)}</ol></Panel>
    </section>
    <section className="grid gap-6 lg:grid-cols-2"><Panel className="p-5 md:p-6"><Label>Idea Radar</Label><div className="mt-2">{ideas.map(i => <ItemLink key={i.slug} href="/ideas" title={i.title} meta={<span className="doto text-2xl text-white">{i.score}</span>}>{i.summary}</ItemLink>)}</div></Panel><Panel className="p-5 md:p-6"><Label>Recent Log</Label><div className="mt-2">{logs.map(l => <ItemLink key={l.slug} href="/log" title={l.title} meta={<span className="caption">{l.date}</span>}>{l.content}</ItemLink>)}</div></Panel></section>
  </div>;
}
