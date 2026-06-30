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
  { label: 'AI 产品', detail: 'usable tools', className: 'brain-node--top-right' },
  { label: '班主任工作流', detail: 'teacher ops', className: 'brain-node--left' },
  { label: '数据分析', detail: 'learning signals', className: 'brain-node--right' },
  { label: '个人 OS', detail: 'knowledge system', className: 'brain-node--bottom-left' },
  { label: '全栈交付', detail: 'ship end to end', className: 'brain-node--bottom-right' }
];

const capabilityRows = [
  { index: '01', title: '懂教育现场', text: '不是只做 demo，而是从教师、班主任、教学管理这些真实流程里找问题。' },
  { index: '02', title: '能把想法做成工具', text: '小程序、数据分析系统、AI 工作台和个人 OS，都尽量做到能被真实使用。' },
  { index: '03', title: '能自己闭环交付', text: '从 Next.js 前台、内容结构、自动同步、GitHub Actions 到 VPS 部署都能接起来。' },
  { index: '04', title: '习惯用证据说话', text: '用截图、上线状态、更新日志和项目数据解释我做过什么，而不是只写一句“热爱 AI”。' }
];

const profileSignals = [
  { label: '定位', value: 'AI + Education Builder' },
  { label: '关键词', value: '教师工作流 / 数据分析 / 个人知识系统' },
  { label: '现在', value: '把教育场景里的重复劳动，做成可复用的软件和 AI 工具。' }
];

const fitRows = [
  '想了解一个既懂教育现场、又能写代码交付的人。',
  '想看 AI 如何落到教师工作流、班级管理、成绩分析里。',
  '想找能独立搭产品原型、内容系统和部署链路的合作者。'
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
              <h2 className="hero-title max-w-4xl text-4xl font-semibold leading-[.92] text-white sm:text-5xl lg:text-6xl">我是 Pigou Wu，做教育 AI 产品和教师工作流工具。</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:mt-5">这里是我的公开简历、作品证据和思维站。你可以快速看见：我关注什么问题、做过哪些东西、以及我如何把一个想法推进到可用。</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <ButtonLink primary href="/about">认识我</ButtonLink>
              <ButtonLink href="/work">看作品</ButtonLink>
            </div>
          </div>
          <div className="brain-map public-hero__map" aria-label="Pigou Wu public thinking map">
            <div className="brain-node brain-node--center">
              <span className="caption text-white/45">CENTER NODE</span>
              <strong>Pigou Wu</strong>
              <span>AI education builder / full-stack shipper</span>
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
          <SectionHeader label="Who I Am" value="10 second read" />
          <div className="grid gap-4">
            {profileSignals.map(item => <div key={item.label} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
              <div className="caption">{item.label}</div>
              <p className="mt-2 text-base font-semibold leading-7 text-[var(--ink)]">{item.value}</p>
            </div>)}
          </div>
        </Panel>
        <Panel raised className="p-5 md:p-6">
          <SectionHeader label="Signal" value="public proof" />
          <div className="grid grid-cols-3 gap-3">
            <Metric value={String(publicProjects.length).padStart(2, '0')} label="projects" />
            <Metric value={String(shippedCount).padStart(2, '0')} label="shipped" />
            <Metric value={String(publicProofCount).padStart(2, '0')} label="proof" />
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <SectionHeader label="Resume Stack" value="what I can do" />
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
        <SectionHeader label="Proof Of Work" value={`${selectedWork.length} public cases`} />
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
        <SectionHeader label="Good Fit" value="why this site exists" />
        <div className="grid gap-5">
          <div className="grid gap-3">
            {fitRows.map((item, index) => <div key={item} className="grid grid-cols-[34px_1fr] gap-3 border-b border-[var(--border)] pb-3 last:border-b-0">
              <span className="doto text-3xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
              <p className="text-sm leading-7 text-[var(--text-primary)]">{item}</p>
            </div>)}
          </div>
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
