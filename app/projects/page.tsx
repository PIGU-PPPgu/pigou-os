import { ItemLink, Label, Panel, SegmentedProgress, StatusBadge } from '@/components/UI';
import { getProjects } from '@/lib/data';

export default function ProjectsPage() {
  const projects = getProjects();
  return <Panel className="p-5"><div className="mb-4 flex items-end justify-between"><Label>Projects</Label><span className="mono text-xs text-white/35">{projects.length} ITEMS</span></div><div className="divide-y divide-white/10">
    {projects.map(p => <ItemLink key={p.slug} href={`/projects/${p.slug}`} title={p.title} meta={<StatusBadge status={p.status} />}><span>{p.summary}</span><div className="mt-4"><SegmentedProgress value={p.progress} /></div></ItemLink>)}
  </div></Panel>;
}
