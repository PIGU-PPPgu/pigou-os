import Link from 'next/link';
import { ReactNode } from 'react';

export function Panel({ children, className = '', raised = false }: { children: ReactNode; className?: string; raised?: boolean }) {
  return <section className={`${raised ? 'surface-raised' : 'surface'} ${className}`}>{children}</section>;
}
export function Label({ children }: { children: ReactNode }) { return <div className="label">{children}</div>; }
export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`mono inline-flex min-h-9 items-center rounded-full border px-4 text-[11px] uppercase ${active ? 'border-white bg-white text-black' : 'border-[var(--border-visible)] text-[var(--text-secondary)]'}`}>{children}</span>;
}
export function Stat({ value, label, unit }: { value: number | string; label: string; unit?: string }) {
  return <Panel className="relative overflow-hidden p-5"><div className="absolute right-4 top-4 h-16 w-24 opacity-20 dot-grid" /><Label>{label}</Label><div className="mt-6 flex items-end gap-2"><span className="doto text-7xl font-black leading-none tracking-[-.08em] text-white">{value}</span>{unit && <span className="caption mb-2">{unit}</span>}</div></Panel>;
}
export function StatusBadge({ status }: { status: string }) {
  const color = status === 'building' ? 'bg-white' : status === 'shipped' ? 'bg-[var(--success)]' : status === 'paused' ? 'bg-[var(--warning)]' : status === 'archived' ? 'bg-[var(--text-disabled)]' : 'bg-[var(--text-secondary)]';
  return <span className="mono inline-flex items-center gap-2 rounded-full border border-[var(--border-visible)] px-3 py-1.5 text-[11px] uppercase text-[var(--text-secondary)]"><span className={`h-1.5 w-1.5 rounded-full ${color}`} />{status}</span>;
}
export function SegmentedProgress({ value, segments = 18 }: { value: number; segments?: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  return <div><div className="mb-2 flex justify-between"><span className="caption">PROGRESS</span><span className="caption text-[var(--text-primary)]">{value}%</span></div><div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>{Array.from({ length: segments }).map((_, i) => <span key={i} className={`h-3 ${i < filled ? 'bg-white' : 'bg-[var(--border)]'}`} />)}</div></div>;
}
export function ItemLink({ href, title, meta, children }: { href: string; title: string; meta?: ReactNode; children?: ReactNode }) {
  return <Link href={href} className="group block border-b border-[var(--border)] py-5 transition last:border-b-0 hover:pl-2"><div className="flex items-start justify-between gap-4"><h3 className="text-2xl font-semibold tracking-[-.055em] text-white">{title}</h3><div className="shrink-0">{meta}</div></div>{children && <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{children}</div>}</Link>;
}
export function ButtonLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link href={href} className={`mono inline-flex min-h-11 items-center rounded-full px-6 text-[13px] uppercase tracking-[.06em] ${primary ? 'bg-white text-black' : 'border border-[var(--border-visible)] text-[var(--text-primary)]'}`}>{children}</Link>;
}
