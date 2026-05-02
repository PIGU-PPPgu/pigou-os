import { ItemLink, Label, Panel, PriorityBadge, SectionHeader, SegmentedProgress, StatusBadge } from '@/components/UI';
import { getProjects, getSyncJobs } from '@/lib/data';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { ProjectPriorityAdvisor } from '@/components/projects/ProjectPriorityAdvisor';
import { ProjectStatusAdvisor } from '@/components/projects/ProjectStatusAdvisor';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = getProjects();
  const syncJobs = getSyncJobs();
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  const statusCounts = {
    building: projects.filter(project => project.status === 'building').length,
    paused: projects.filter(project => project.status === 'paused').length,
    idea: projects.filter(project => project.status === 'idea').length,
    private: projects.filter(project => project.visibility === 'private').length
  };
  const stalled = projects.filter(project => project.status === 'paused').slice(0, 5);
  const highPriority = projects.filter(project => project.priority === 'high' && project.status !== 'archived').slice(0, 5);
  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Label>项目 / 清单</Label>
          <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">现在有哪些项目？</h2>
        </div>
        <span className="doto text-7xl leading-none text-[var(--ink)]">{String(projects.length).padStart(2, '0')}</span>
      </div>
    </Panel>

    <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="项目态势" value="状态分布" />
        <div className="grid grid-cols-2 gap-3">
          <div className="border-b border-[var(--border)] pb-3"><span className="caption">推进中</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{statusCounts.building}</div></div>
          <div className="border-b border-[var(--border)] pb-3"><span className="caption">暂停/卡住</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{statusCounts.paused}</div></div>
          <div><span className="caption">想法态</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{statusCounts.idea}</div></div>
          <div><span className="caption">内部项目</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{statusCounts.private}</div></div>
        </div>
      </Panel>
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="需要处理" value="高优先级 / 卡住项" />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="caption mb-2">高优先级</div>
            {highPriority.map(project => <div key={project.slug} className="border-b border-[var(--border)] py-2 text-sm leading-6 last:border-b-0">{project.title}</div>)}
          </div>
          <div>
            <div className="caption mb-2">暂停/卡住</div>
            {stalled.map(project => <div key={project.slug} className="border-b border-[var(--border)] py-2 text-sm leading-6 last:border-b-0">{project.title}</div>)}
          </div>
        </div>
      </Panel>
    </section>

    <SyncStatus jobs={syncJobs} />

    <ProjectPriorityAdvisor enabled={isLoggedIn} />

    <ProjectStatusAdvisor enabled={isLoggedIn} />

    <Panel className="p-5 md:p-6">
      <SectionHeader label="项目登记册" value={`${projects.length} 个项目`} />
      <div>
        {projects.map(p => {
          const locked = p.visibility === 'private' && !isLoggedIn;
          return <ItemLink key={p.slug} href={`/projects/${p.slug}`} title={p.title} meta={<div className="flex flex-wrap justify-end gap-2">{p.visibility === 'private' && <span className="mono inline-flex min-h-7 items-center rounded-full border border-[var(--ink)] px-3 text-[10px] uppercase text-[var(--ink)]">{locked ? 'locked' : '内部'}</span>}<PriorityBadge priority={p.priority} /><StatusBadge status={p.status} /></div>}>
            <span>{p.summary}</span>
            {locked && p.explanation && <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="caption mr-2">公开简介</span>{p.explanation}</div>}
            {!locked && p.readme?.[0] && <div className="mt-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="caption mr-2">README</span>{p.readme[0]}</div>}
            {!locked && <div className="mt-5"><SegmentedProgress value={p.progress} /></div>}
            {!locked && p.prioritySuggestion && p.prioritySuggestion.suggestedPriority !== p.priority && <div className="caption mt-3">AI priority suggests {p.prioritySuggestion.suggestedPriority} / {p.prioritySuggestion.confidence} / score {p.prioritySuggestion.score}</div>}
            {!locked && p.progressEvaluation && <div className="caption mt-3">AI / {p.progressEvaluation.model} / {p.progressEvaluation.confidence} / {p.progressEvaluation.generatedAt}</div>}
            <div className="caption mt-3">{p.domain && !locked ? `${p.domain} / ` : ''}更新于 / {p.updated}</div>
          </ItemLink>;
        })}
      </div>
    </Panel>
  </div>;
}
