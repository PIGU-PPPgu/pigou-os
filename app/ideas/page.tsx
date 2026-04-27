import { ItemLink, Label, Panel, StatusBadge } from '@/components/UI';
import { getIdeas } from '@/lib/data';

export default function IdeasPage() {
  const ideas = getIdeas();
  return <Panel className="p-5"><div className="mb-4 flex items-end justify-between"><Label>Idea Radar</Label><span className="mono text-xs text-white/35">SCORE / 100</span></div><div className="divide-y divide-white/10">{ideas.map(i => <ItemLink key={i.slug} href="/ideas" title={i.title} meta={<span className="flex items-center gap-3"><StatusBadge status={i.status} /><span className="mono text-xs text-white/45">{i.score}</span></span>}>{i.summary}<div className="mono mt-3 text-[10px] uppercase tracking-[.18em] text-white/35">{i.tags.join(' / ')}</div></ItemLink>)}</div></Panel>;
}
