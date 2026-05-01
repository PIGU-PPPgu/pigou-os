import { Panel, SectionHeader } from '@/components/UI';
import type { SyncStrategy, SyncStrategyNode } from '@/lib/sync-strategy';

const statusClass: Record<SyncStrategyNode['status'], string> = {
  healthy: 'border-[var(--success)] text-[var(--success)]',
  watch: 'border-[var(--warning)] text-[var(--warning)]',
  blocked: 'border-[var(--danger)] text-[var(--danger)]'
};

const modeLabel: Record<SyncStrategy['flows'][number]['mode'], string> = {
  pull: 'pull',
  derive: 'derive',
  write: 'write',
  review: 'review'
};

export function SyncStrategyPanel({ strategy }: { strategy: SyncStrategy }) {
  const nodeMap = new Map(strategy.nodes.map(node => [node.id, node]));

  return <Panel className="p-5 md:p-6">
    <SectionHeader label="Sync Strategy" value={new Date(strategy.generatedAt).toISOString().slice(0, 10)} />
    <div className="grid gap-5">
      <p className="max-w-4xl text-sm leading-7 text-[var(--text-secondary)]">{strategy.headline}</p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {strategy.nodes.map(node => <div key={node.id} className="min-h-36 rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="caption">{node.kind}</div>
              <div className="mt-2 text-lg font-semibold leading-tight text-[var(--ink)]">{node.label}</div>
            </div>
            <span className={`mono rounded-full border px-2 py-1 text-[9px] uppercase ${statusClass[node.status]}`}>{node.status}</span>
          </div>
          <div className="mt-5 doto text-5xl leading-none text-[var(--ink)]">{node.count}</div>
          <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{node.detail}</p>
        </div>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-[8px] border border-[var(--border)] bg-white/30 p-4">
          <div className="caption mb-3">Flow Map</div>
          <div className="grid gap-2">
            {strategy.flows.map(flow => <div key={`${flow.from}-${flow.to}-${flow.label}`} className="grid gap-2 border-b border-[var(--border)] py-3 last:border-b-0 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--ink)]">{nodeMap.get(flow.from)?.label || flow.from}</div>
                <div className="caption mt-1">{nodeMap.get(flow.from)?.kind}</div>
              </div>
              <div className="flex items-center gap-2 md:justify-center">
                <span className="mono rounded-full border border-[var(--border-visible)] bg-white/50 px-3 py-1 text-[9px] uppercase text-[var(--text-secondary)]">{modeLabel[flow.mode]}</span>
                <span className="caption">to</span>
              </div>
              <div className="min-w-0 md:text-right">
                <div className="truncate text-sm font-semibold text-[var(--ink)]">{nodeMap.get(flow.to)?.label || flow.to}</div>
                <div className="caption mt-1">{flow.label}</div>
              </div>
            </div>)}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-[8px] border border-[var(--border)] bg-white/30 p-4">
            <div className="caption mb-3">Cadence</div>
            <div className="grid gap-3">
              {strategy.cadences.map(item => <div key={item.label} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
                <div>
                  <div className="text-sm font-semibold text-[var(--ink)]">{item.label}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.detail}</p>
                </div>
                <div className="caption text-right text-[var(--text-primary)]">{item.value}</div>
              </div>)}
            </div>
          </div>

          <div className="rounded-[8px] border border-[var(--border)] bg-white/30 p-4">
            <div className="caption mb-3">Safeguards</div>
            <ul className="grid gap-2">
              {strategy.safeguards.map(item => <li key={item} className="text-sm leading-6 text-[var(--text-secondary)]">{item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Panel>;
}
