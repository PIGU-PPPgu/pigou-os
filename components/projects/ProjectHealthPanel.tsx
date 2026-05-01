import type { ProjectHealth } from '@/lib/project-health';
import { Panel, SectionHeader } from '@/components/UI';

function toneClass(tone: ProjectHealth['tone']) {
  if (tone === 'green') return 'text-[var(--success)]';
  if (tone === 'yellow') return 'text-[var(--accent)]';
  return 'text-[var(--danger)]';
}

export function ProjectHealthPanel({ health }: { health: ProjectHealth }) {
  return <Panel className="p-5 md:p-6">
    <SectionHeader label="Project Health" value={<span className={toneClass(health.tone)}>{health.label}</span>} />
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
        <div className="caption">health score</div>
        <div className={`doto mt-5 text-7xl leading-none ${toneClass(health.tone)}`}>{health.score}</div>
      </div>
      <div className="grid gap-3">
        {health.dimensions.map(dimension => <div key={dimension.key} className="border-b border-[var(--border)] pb-3 last:border-b-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="caption">{dimension.label}</span>
            <span className="caption text-[var(--text-primary)]">{dimension.score}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="h-full bg-[var(--ink)]" style={{ width: `${dimension.score}%` }} /></div>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{dimension.reason}</p>
        </div>)}
      </div>
    </div>
    {health.blockers.length > 0 && <div className="mt-5 rounded-[8px] border border-[var(--warning)]/45 bg-white/45 p-4">
      <div className="caption mb-2">需要注意</div>
      <ul className="grid gap-2 text-sm leading-6 text-[var(--text-secondary)] md:grid-cols-2">
        {health.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}
      </ul>
    </div>}
  </Panel>;
}
