import Link from 'next/link';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import type { Project, UpdateLog } from '@/lib/data';
import { getPublicProjects } from '@/lib/public-projects';

type PublicHomepageProps = {
  projects: Project[];
  updates: UpdateLog[];
};

const brainNodes = [
  { label: '教育现场', detail: 'real problems', className: 'brain-node--top-left' },
  { label: '班主任工作流', detail: 'teacher ops', className: 'brain-node--top-right' },
  { label: '数据分析', detail: 'learning signals', className: 'brain-node--bottom-left' },
  { label: '全栈交付', detail: 'ship end to end', className: 'brain-node--bottom-right' }
];

export function PublicHomepage({ projects, updates }: PublicHomepageProps) {
  const publicProjects = getPublicProjects(projects);
  const selectedWork = selectPublicProjects(publicProjects);
  const latestUpdate = updates.find(update => update.status === 'shipped');

  return <div className="public-home grid gap-5">
    <section className="grid gap-5">
      <Panel dark className="console-screen public-hero relative min-h-[520px] overflow-hidden p-5 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="brain-map-lines" aria-hidden="true">
          {brainNodes.map(node => <span key={node.className} className={`brain-line ${node.className.replace('brain-node', 'brain-line')}`} />)}
        </div>
        <div className="scanline" />
        <div className="public-hero__body relative grid h-full gap-6 lg:gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Pigou Wu</Label>
            <div className="flex flex-wrap gap-3">
              <ButtonLink primary href="/work">看作品</ButtonLink>
              <ButtonLink href="/about">认识我</ButtonLink>
            </div>
          </div>
          <div className="brain-map public-hero__map" aria-label="Pigou Wu public thinking map">
            <div className="brain-node brain-node--center">
              <span className="caption text-white/45">CENTER NODE</span>
              <strong>Pigou Wu</strong>
              <span>班主任，独立开发者</span>
            </div>
            {brainNodes.map(node => <div key={node.label} className={`brain-node ${node.className}`}>
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </div>)}
          </div>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Proof Of Work" value={`${selectedWork.length} public cases`} />
        <div className="grid gap-5">
          {selectedWork.map(project => <Link key={project.slug} href={`/projects/${project.slug}`} className="group grid gap-4 border-b border-[var(--border)] pb-5 transition last:border-b-0 last:pb-0 hover:bg-white/40 md:grid-cols-[1fr_auto] md:p-3">
            <div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
              <h3 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{project.summary}</p>
              <div className="caption mt-3">{project.domain || 'project'} / progress {project.progress}% / updated {project.updated}</div>
            </div>
            <span className="mono self-end rounded-full border border-[var(--border-visible)] px-4 py-2 text-[10px] uppercase text-[var(--text-secondary)] group-hover:border-[var(--ink)] group-hover:text-[var(--ink)]">open</span>
          </Link>)}
        </div>
      </Panel>

      <aside className="grid gap-5 content-start">
        <Panel raised className="p-5 md:p-6">
          <SectionHeader label="Latest" value="what just shipped" />
          {latestUpdate ? <Link href="/updates" className="block">
            <div className="caption">{latestUpdate.version} / {latestUpdate.type} / {latestUpdate.date}</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-[var(--ink)]">{latestUpdate.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{latestUpdate.summary}</p>
          </Link> : <p className="text-sm leading-6 text-[var(--text-secondary)]">Quiet.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/updates">Updates</ButtonLink>
            <ButtonLink href="/projects/pigou-os">This site</ButtonLink>
          </div>
        </Panel>
      </aside>
    </section>
  </div>;
}

function selectPublicProjects(projects: Project[]) {
  const statusRank: Record<Project['status'], number> = { shipped: 0, building: 1, idea: 2, paused: 3, archived: 4 };
  return projects
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.progress - a.progress)
    .slice(0, 4);
}
