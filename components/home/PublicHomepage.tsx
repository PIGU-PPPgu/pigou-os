import Link from 'next/link';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import type { Project, UpdateLog } from '@/lib/data';
import { getPublicProjects } from '@/lib/public-projects';

type PublicHomepageProps = {
  projects: Project[];
  updates: UpdateLog[];
};

const brainNodes = [
  { label: '教育 AI', detail: 'teacher tools', className: 'brain-node--top-left' },
  { label: '教师工作流', detail: 'classroom ops', className: 'brain-node--top-right' },
  { label: '个人知识系统', detail: 'thinking OS', className: 'brain-node--left' },
  { label: '数据分析', detail: 'learning signals', className: 'brain-node--right' },
  { label: 'Agent 工程', detail: 'tool chains', className: 'brain-node--bottom-left' },
  { label: '产品交付', detail: 'shipped proof', className: 'brain-node--bottom-right' }
];

const capabilityRows = [
  { index: '01', title: 'AI education products', text: '把真实教师工作流拆成可使用的小程序、数据系统和 AI 工作台。' },
  { index: '02', title: 'Personal OS building', text: '用项目、知识、想法、行动和日志串起自己的长期操作系统。' },
  { index: '03', title: 'Full-stack shipping', text: '从 Next.js 前台、内容结构、自动同步到 VPS 部署都能闭环。' },
  { index: '04', title: 'Evidence-first iteration', text: '用截图、项目状态、更新日志和同步信号证明进展，而不是只写愿景。' }
];

export function PublicHomepage({ projects, updates }: PublicHomepageProps) {
  const publicProjects = getPublicProjects(projects);
  const selectedWork = selectPublicProjects(publicProjects);
  const latestUpdates = updates.filter(update => update.status === 'shipped').slice(0, 3);
  const shippedCount = publicProjects.filter(project => project.status === 'shipped').length;
  const publicProofCount = publicProjects.filter(project => project.images?.some(image => image.public)).length;

  return <div className="public-home grid gap-5">
    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Panel dark className="console-screen public-hero relative min-h-[560px] overflow-hidden p-5 md:p-8 lg:min-h-[620px]">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="brain-map-lines" aria-hidden="true">
          {brainNodes.map(node => <span key={node.className} className={`brain-line ${node.className.replace('brain-node', 'brain-line')}`} />)}
        </div>
        <div className="scanline" />
        <div className="public-hero__body relative grid h-full gap-6 lg:gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Pigou Wu / Public Brain</Label>
            <span className="live-pill mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55">Brain map</span>
          </div>
          <div className="public-hero__copy grid gap-5 border-t border-white/15 pt-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="hero-title max-w-4xl text-4xl font-semibold leading-[.92] text-white sm:text-5xl lg:text-6xl xl:text-7xl">把教育现场、个人知识和 AI 工程接成一套操作系统。</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:mt-5">这里不是普通主页，而是 Pigou 的公开思维站、作品证据和简历入口。</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <ButtonLink primary href="/work">View work</ButtonLink>
              <ButtonLink href="/about">Resume</ButtonLink>
            </div>
          </div>
          <div className="brain-map public-hero__map" aria-label="Pigou Wu public thinking map">
            <div className="brain-node brain-node--center">
              <span className="caption text-white/45">CENTER NODE</span>
              <strong>Pigou Wu</strong>
              <span>AI education builder / personal OS maker</span>
            </div>
            {brainNodes.map(node => <div key={node.label} className={`brain-node ${node.className}`}>
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </div>)}
          </div>
        </div>
      </Panel>

      <aside className="grid gap-5">
        <Panel raised className="p-5 md:p-6">
          <SectionHeader label="Signal" value="public proof" />
          <div className="grid grid-cols-3 gap-3">
            <Metric value={String(publicProjects.length).padStart(2, '0')} label="projects" />
            <Metric value={String(shippedCount).padStart(2, '0')} label="shipped" />
            <Metric value={String(publicProofCount).padStart(2, '0')} label="proof" />
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <SectionHeader label="Resume Stack" value="what I keep building" />
          <div className="grid gap-4">
            {capabilityRows.map(row => <div key={row.index} className="grid grid-cols-[42px_1fr] gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
              <span className="doto text-4xl leading-none text-[var(--text-disabled)]">{row.index}</span>
              <div>
                <h3 className="text-base font-semibold leading-tight text-[var(--ink)]">{row.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{row.text}</p>
              </div>
            </div>)}
          </div>
        </Panel>
      </aside>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Selected Work" value={`${selectedWork.length} public signals`} />
        <div className="grid gap-5">
          {selectedWork.map(project => <Link key={project.slug} href={`/projects/${project.slug}`} className="group grid gap-4 border-b border-[var(--border)] pb-5 transition last:border-b-0 last:pb-0 hover:bg-white/40 md:grid-cols-[1fr_auto] md:p-3">
            <div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
              <h3 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{project.explanation || project.summary}</p>
              <div className="caption mt-3">{project.domain || 'project'} / progress {project.progress}% / updated {project.updated}</div>
            </div>
            <span className="mono self-end rounded-full border border-[var(--border-visible)] px-4 py-2 text-[10px] uppercase text-[var(--text-secondary)] group-hover:border-[var(--ink)] group-hover:text-[var(--ink)]">open</span>
          </Link>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Thinking System" value="updates / knowledge / meta" />
        <div className="grid gap-5">
          {latestUpdates.map(update => <Link key={update.slug} href="/updates" className="block border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
            <div className="caption">{update.version} / {update.type} / {update.date}</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-[var(--ink)]">{update.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{update.summary}</p>
          </Link>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/updates">Updates</ButtonLink>
            <ButtonLink href="/work">Public work</ButtonLink>
          </div>
        </div>
      </Panel>
    </section>
  </div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="min-w-0 border-r border-[var(--border)] pr-3 last:border-r-0">
    <div className="doto text-5xl leading-none text-[var(--ink)]">{value}</div>
    <div className="caption mt-2">{label}</div>
  </div>;
}

function selectPublicProjects(projects: Project[]) {
  const statusRank: Record<Project['status'], number> = { shipped: 0, building: 1, idea: 2, paused: 3, archived: 4 };

  return projects
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.progress - a.progress)
    .slice(0, 4);
}
