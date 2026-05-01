import { Panel, SectionHeader } from '@/components/UI';
import type { ProjectAutoBrief as ProjectAutoBriefData } from '@/lib/project-brief';

function toneClass(tone: ProjectAutoBriefData['verdict']['tone']) {
  if (tone === 'green') return 'text-[var(--success)]';
  if (tone === 'yellow') return 'text-[var(--accent)]';
  return 'text-[var(--danger)]';
}

function Signal({ label, value }: { label: string; value: string | number }) {
  return <div className="border-b border-[var(--border)] pb-3 last:border-b-0">
    <div className="caption">{label}</div>
    <div className="mt-1 text-sm font-medium leading-6 text-[var(--ink)]">{value}</div>
  </div>;
}

export function ProjectAutoBrief({ brief }: { brief: ProjectAutoBriefData }) {
  return <Panel className="p-5 md:p-6">
    <SectionHeader label="自动项目简报" value={<span className={toneClass(brief.verdict.tone)}>{brief.verdict.label}</span>} />
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="grid gap-4">
        <div className="rounded-[8px] border border-[var(--border)] bg-white/50 p-4">
          <div className="caption mb-2">现在是什么状态</div>
          <p className="text-sm leading-7 text-[var(--text-primary)]">{brief.status}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[8px] border border-[var(--danger)]/35 bg-white/45 p-4">
            <div className="caption mb-2 text-[var(--text-primary)]">当前最大风险</div>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">{brief.biggestRisk}</p>
          </div>
          <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
            <div className="caption mb-2">下一步最该做什么</div>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">{brief.nextBestAction}</p>
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="caption mb-2">是否值得继续推进</div>
          <div className={`text-2xl font-semibold leading-tight ${toneClass(brief.verdict.tone)}`}>{brief.verdict.label}</div>
          <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{brief.verdict.reason}</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">最近 GitHub / wiki / 工作流变化</div>
          <ul className="grid gap-3">
            {brief.recentChanges.map(change => <li key={change} className="border-b border-[var(--border)] pb-3 text-sm leading-6 text-[var(--text-secondary)] last:border-b-0 last:pb-0">{change}</li>)}
          </ul>
        </div>

        <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="caption mb-3">信号来源</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <Signal label="source" value={brief.signals.source} />
            <Signal label="progress" value={`${brief.signals.progress}%`} />
            <Signal label="health" value={brief.signals.healthScore} />
            <Signal label="open tasks" value={brief.signals.openTasks} />
            {brief.signals.repoPushedAt && <Signal label="repo pushed" value={brief.signals.repoPushedAt.slice(0, 10)} />}
            {brief.signals.wikiGeneratedAt && <Signal label="wiki snapshot" value={brief.signals.wikiGeneratedAt.slice(0, 10)} />}
          </div>
        </div>
      </div>
    </div>
  </Panel>;
}
