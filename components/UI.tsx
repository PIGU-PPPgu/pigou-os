import Link from 'next/link';
import { ReactNode } from 'react';

export function Panel({ children, className = '', raised = false, dark = false }: { children: ReactNode; className?: string; raised?: boolean; dark?: boolean }) {
  const tone = dark ? 'surface-dark' : raised ? 'surface-raised' : 'surface';
  return <section className={`${tone} motion-panel panel-corners w-full max-w-full min-w-0 ${className}`}>{children}</section>;
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="label">{children}</div>;
}

export function SectionHeader({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-end">
    <Label>{label}</Label>
    {value && <div className="caption max-w-full text-left sm:text-right">{value}</div>}
  </div>;
}

export function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`mono inline-flex min-h-8 items-center rounded-full border px-4 text-[10px] uppercase ${active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--border-visible)] bg-white/35 text-[var(--text-secondary)]'}`}>{children}</span>;
}

export function Stat({ value, label, unit }: { value: number | string; label: string; unit?: string }) {
  return <Panel className="relative min-h-36 overflow-hidden p-5">
    <div className="absolute right-4 top-4 h-16 w-24 text-[var(--text-disabled)] opacity-30 dot-grid" />
    <Label>{label}</Label>
    <div className="mt-7 flex items-end gap-2">
      <span className="doto text-6xl font-black leading-none text-[var(--ink)] md:text-7xl">{value}</span>
      {unit && <span className="caption mb-2">{unit}</span>}
    </div>
  </Panel>;
}

export function StatusBadge({ status }: { status: string }) {
  const color = status === 'building' ? 'bg-[var(--success)]' : status === 'shipped' ? 'bg-[var(--ink)]' : status === 'paused' ? 'bg-[var(--warning)]' : status === 'killed' || status === 'archived' ? 'bg-[var(--danger)]' : status === 'validated' || status === 'linked' ? 'bg-[var(--accent)]' : status === 'processed' ? 'bg-[var(--success)]' : 'bg-[var(--text-disabled)]';
  const label: Record<string, string> = { idea: '想法', building: '推进中', paused: '暂停', shipped: '已发布', archived: '归档', spark: '火花', validated: '已验证', killed: '放弃', raw: '原始', processed: '已处理', linked: '已关联' };
  return <span className="mono inline-flex items-center gap-2 rounded-full border border-[var(--border-visible)] bg-white/60 px-3 py-1.5 text-[10px] uppercase text-[var(--text-secondary)]"><span className={`status-light h-1.5 w-1.5 rounded-full ${color}`} />{label[status] ?? status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const active = priority === 'high';
  const label: Record<string, string> = { high: '高优先级', medium: '中优先级', low: '低优先级' };
  return <span className={`mono inline-flex min-h-7 items-center rounded-full border px-3 text-[10px] uppercase ${active ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border-visible)] text-[var(--text-secondary)]'}`}>{label[priority] ?? priority}</span>;
}

export function SegmentedProgress({ value, segments = 18 }: { value: number; segments?: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  return <div>
    <div className="mb-2 flex justify-between"><span className="caption">进度</span><span className="caption text-[var(--text-primary)]">{value}%</span></div>
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}>
      {Array.from({ length: segments }).map((_, i) => <span key={i} className={`progress-segment h-3 rounded-[1px] ${i < filled ? 'is-filled' : ''}`} />)}
    </div>
  </div>;
}

export function ItemLink({ href, title, meta, children }: { href: string; title: string; meta?: ReactNode; children?: ReactNode }) {
  return <Link href={href} className="group block border-b border-[var(--border)] py-5 transition last:border-b-0 hover:bg-[var(--surface-soft)]/55 md:px-3 md:hover:px-4">
    <div className="flex items-start justify-between gap-4">
      <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{title}</h3>
      <div className="shrink-0">{meta}</div>
    </div>
    {children && <div className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{children}</div>}
  </Link>;
}

export function ButtonLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return <Link href={href} className={`mono inline-flex min-h-11 items-center rounded-full px-6 text-[12px] uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${primary ? 'primary-action' : 'border border-[var(--border-visible)] bg-white/40 text-[var(--text-primary)] hover:border-[var(--ink)]'}`}>{children}</Link>;
}

export function MiniMeter({ value, label }: { value: number; label: string }) {
  return <div>
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="caption">{label}</span>
      <span className="caption text-[var(--text-primary)]">{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="meter-fill h-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
  </div>;
}
