import Link from 'next/link';
import { Label, Panel } from '@/components/UI';
import { getAllTasks } from '@/lib/data';

export default function TasksPage() {
  const tasks = getAllTasks();
  return <Panel className="p-5"><Label>Next Actions</Label><div className="mt-5 divide-y divide-white/10">{tasks.map((t, i) => <div key={`${t.slug}-${t.index}`} className="grid gap-2 py-4 md:grid-cols-[48px_1fr_180px]"><span className="mono text-white/35">{String(i+1).padStart(2,'0')}</span><span>{t.task}</span><Link className="mono text-xs text-white/40 hover:text-white" href={`/projects/${t.slug}`}>{t.project}</Link></div>)}</div></Panel>;
}
