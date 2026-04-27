import { Label, Panel } from '@/components/UI';
import { getLogs } from '@/lib/data';

export default function LogPage() {
  const logs = getLogs();
  return <div className="grid gap-4">{logs.map(l => <Panel key={l.slug} className="p-5"><div className="flex items-start justify-between gap-4"><div><Label>{l.date}</Label><h2 className="mt-2 text-3xl font-black uppercase tracking-[-.05em]">{l.title}</h2></div><span className="mono text-xs text-white/35">{l.tags.join(' / ')}</span></div><p className="mt-5 max-w-3xl leading-7 text-white/65">{l.content}</p></Panel>)}</div>;
}
