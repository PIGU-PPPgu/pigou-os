import { notFound } from 'next/navigation';
import { Label, Panel, SegmentedProgress, StatusBadge } from '@/components/UI';
import { getProject, getProjects } from '@/lib/data';

export function generateStaticParams() { return getProjects().map(p => ({ slug: p.slug })); }

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
    <Panel className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><Label>Project</Label><h2 className="mt-3 text-5xl font-black uppercase tracking-[-.07em]">{project.title}</h2></div><StatusBadge status={project.status} /></div><p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">{project.summary}</p><div className="mt-8"><Label>SegmentedProgress</Label><div className="mt-3"><SegmentedProgress value={project.progress} /></div><div className="mono mt-2 text-xs text-white/40">{project.progress}%</div></div></Panel>
    <div className="grid gap-6"><Panel className="p-5"><Label>Goals</Label><ul className="mt-4 space-y-3 text-sm text-white/70">{project.goals.map(g => <li key={g}>▸ {g}</li>)}</ul></Panel><Panel className="p-5"><Label>Next Actions</Label><ul className="mt-4 space-y-3 text-sm">{project.nextActions.map(a => <li key={a}>□ {a}</li>)}</ul></Panel><Panel className="p-5"><Label>Links</Label><div className="mt-4 grid gap-2">{project.links?.map(l => <a key={l.url} href={l.url} target="_blank" className="mono border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white hover:text-black">{l.label}</a>)}</div></Panel></div>
  </div>;
}
