import { notFound } from 'next/navigation';
import { DeleteContentButton } from '@/components/auth/AuthControls';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, SegmentedProgress, StatusBadge } from '@/components/UI';
import { ImageGallery } from '@/components/ImageGallery';
import { getIdeas, getKnowledge, getLogs, getProject, getProjects, getProjectWikiSnapshot, getTasks } from '@/lib/data';
import type { Idea, KnowledgeNote, Log, Task } from '@/lib/data';
import { ProjectDeepWiki } from '@/components/projects/ProjectDeepWiki';
import { ProjectHealthPanel } from '@/components/projects/ProjectHealthPanel';
import { ProjectAutoBrief } from '@/components/projects/ProjectAutoBrief';
import { evaluateProjectHealth } from '@/lib/project-health';
import { generateProjectBrief } from '@/lib/project-brief';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export function generateStaticParams() { return getProjects().map(p => ({ slug: p.slug })); }

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const wikiSnapshot = getProjectWikiSnapshot(project.slug);
  const related = getProjectRelations(project.slug);
  const health = evaluateProjectHealth({ project, wiki: wikiSnapshot, tasks: related.tasks, logs: related.logs });
  const brief = generateProjectBrief({ project, wikiSnapshot, tasks: related.tasks, logs: related.logs, health });
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  const locked = project.visibility === 'private' && !isLoggedIn;
  const visibleImages = project.images?.filter(image => !locked || image.public) ?? [];

  return <div className="grid gap-5">
    <Panel raised className="overflow-hidden p-6 md:p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">{project.visibility === 'private' && <span className="mono inline-flex min-h-7 items-center rounded-full border border-[var(--ink)] px-3 text-[10px] uppercase text-[var(--ink)]">内部</span>}<StatusBadge status={project.status} /><PriorityBadge priority={project.priority} />{project.domain && <span className="mono inline-flex min-h-7 items-center rounded-full border border-[var(--border-visible)] px-3 text-[10px] uppercase text-[var(--text-secondary)]">{project.domain}</span>}</div>
          <h2 className="mt-5 text-5xl font-semibold leading-[.95] text-[var(--ink)] md:text-8xl">{project.title}</h2>
          <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--text-secondary)]">{project.summary}</p>
          {locked && project.explanation && <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{project.explanation}</p>}
        </div>
        <div className="surface-dark panel-corners p-5">
          <Label>进度读数</Label>
          <div className="mt-6 flex items-end gap-3">
            <span className="doto text-8xl leading-none text-white">{locked ? 'LOCK' : project.progress}</span>
            <span className="caption mb-3 text-white/45">{locked ? 'private' : '百分比'}</span>
          </div>
          {!locked && <div className="mt-7"><SegmentedProgress value={project.progress} /></div>}
          <div className="caption mt-5 text-white/45">{locked ? 'login required' : `更新于 / ${project.updated}`}</div>
        </div>
      </div>
    </Panel>

    {locked ? <>
    {visibleImages.length > 0 && <Panel className="p-5 md:p-6">
      <SectionHeader label="公开素材" value={`${visibleImages.length} 张`} />
      <ImageGallery images={visibleImages} />
    </Panel>}
    <Panel className="p-5 md:p-6">
      <SectionHeader label="Private Boundary" value="login required" />
      <div className="grid gap-3 text-sm leading-7 text-[var(--text-secondary)]">
        <p>This project is marked private, so Pigou OS only shows a high-level introduction and approved public media for visitors. README details, internal images, goals, next actions, links, repository wiki, code graph, and DeepWiki answers stay hidden.</p>
        <p>After login, the same URL unlocks the private cockpit view.</p>
        <a href="/login" className="mono mt-2 inline-flex min-h-10 w-fit items-center rounded-full border border-[var(--ink)] px-4 text-[10px] uppercase text-[var(--ink)]">login</a>
      </div>
    </Panel>
    </> : <>
    <ProjectAutoBrief brief={brief} />

    <section className="grid gap-5 lg:grid-cols-[.9fr_.9fr_.7fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="目标" value={`${project.goals.length} 项`} />
        <ul className="space-y-3">
          {project.goals.map((goal, index) => <li key={goal} className="grid grid-cols-[34px_1fr] gap-3 border-b border-[var(--border)] pb-3 text-sm leading-6 last:border-b-0 last:pb-0">
            <span className="doto text-2xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
            <span>{goal}</span>
          </li>)}
        </ul>
      </Panel>
      <Panel className="p-5 md:p-6">
        <SectionHeader label="下一步行动" value="接下来做" />
        <ul className="space-y-3">
          {project.nextActions.map((action, index) => <li key={action} className="grid grid-cols-[22px_1fr] gap-3 border-b border-[var(--border)] pb-3 text-sm leading-6 last:border-b-0 last:pb-0">
            <span className="mt-1.5 h-3 w-3 rounded-full border border-[var(--border-visible)] bg-white" />
            <span><span className="caption mr-2">{String(index + 1).padStart(2, '0')}</span>{action}</span>
          </li>)}
        </ul>
      </Panel>
      <Panel className="p-5 md:p-6">
        <SectionHeader label="链接" value={project.visibility === 'private' ? '已隐藏' : project.links?.length ? '外部链接' : '无'} />
        <div className="grid gap-2">
          {project.visibility === 'private' ? <p className="text-sm leading-6 text-[var(--text-secondary)]">这是未公开/内部项目，因此不展示外部仓库链接，只保留说明和本地图片。</p> : project.links?.length ? project.links.map(link => <a key={link.url} href={link.url} target="_blank" className="mono rounded-full border border-[var(--border-visible)] bg-white/45 px-4 py-3 text-center text-[11px] uppercase text-[var(--text-secondary)] transition hover:border-[var(--ink)] hover:text-[var(--ink)]">{link.label}</a>) : <p className="text-sm leading-6 text-[var(--text-secondary)]">暂未附加外部链接。</p>}
        </div>
      </Panel>
    </section>

    <ProjectHealthPanel health={health} />

    {project.prioritySuggestion && <Panel className="p-5 md:p-6">
      <SectionHeader label="AI Priority Evaluation" value={`${project.prioritySuggestion.source} / ${project.prioritySuggestion.model} / ${project.prioritySuggestion.confidence}`} />
      <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <div><div className="caption mb-1">current</div><PriorityBadge priority={project.priority} /></div>
            <div><div className="caption mb-1">suggested</div><PriorityBadge priority={project.prioritySuggestion.suggestedPriority} /></div>
          </div>
          <div className="mt-5">
            <span className="caption">priority score</span>
            <div className="doto mt-1 text-6xl leading-none text-[var(--ink)]">{project.prioritySuggestion.score}</div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{project.prioritySuggestion.rationale}</p>
          <div className="caption mt-4">generated / {project.prioritySuggestion.generatedAt}</div>
        </div>
        <div className="grid gap-3">
          {project.prioritySuggestion.dimensions.map(dimension => <div key={dimension.name} className="border-b border-[var(--border)] pb-3 last:border-b-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="caption">{dimension.name}</span>
              <span className="caption text-[var(--text-primary)]">{dimension.score}/{dimension.max}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="meter-fill h-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, (dimension.score / dimension.max) * 100))}%` }} /></div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{dimension.reason}</p>
          </div>)}
        </div>
      </div>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <EvidenceList title="Evidence" items={project.prioritySuggestion.evidence} />
      </div>
    </Panel>}

    {project.progressEvaluation && <Panel className="p-5 md:p-6">
      <SectionHeader label="AI Progress Evaluation" value={`${project.progressEvaluation.source} / ${project.progressEvaluation.model} / ${project.progressEvaluation.confidence}`} />
      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <p className="text-sm leading-7 text-[var(--text-primary)]">{project.progressEvaluation.summary}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{project.progressEvaluation.rationale}</p>
          <div className="caption mt-4">generated / {project.progressEvaluation.generatedAt}</div>
        </div>
        <div className="grid gap-3">
          {project.progressEvaluation.dimensions.map(dimension => <div key={dimension.name} className="border-b border-[var(--border)] pb-3 last:border-b-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="caption">{dimension.name}</span>
              <span className="caption text-[var(--text-primary)]">{dimension.score}/{dimension.max}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="meter-fill h-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, (dimension.score / dimension.max) * 100))}%` }} /></div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{dimension.reason}</p>
          </div>)}
        </div>
      </div>
      <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-4 md:grid-cols-3">
        <EvidenceList title="Evidence" items={project.progressEvaluation.evidence} />
        <EvidenceList title="Risks" items={project.progressEvaluation.risks} />
        <EvidenceList title="AI Next" items={project.progressEvaluation.nextActions} />
      </div>
    </Panel>}

    {(project.readme?.length || project.images?.length) && <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      {project.readme?.length && <Panel className="p-5 md:p-6">
        <SectionHeader label="README 摘要" value={project.visibility === 'private' ? '本地摘录' : '项目说明'} />
        <div className="space-y-3">
          {project.readme.map((item, index) => <p key={index} className="border-b border-[var(--border)] pb-3 text-sm leading-7 text-[var(--text-secondary)] last:border-b-0 last:pb-0">{item}</p>)}
        </div>
      </Panel>}
      {visibleImages.length > 0 && <Panel className="p-5 md:p-6">
        <SectionHeader label="README 图片" value={`${visibleImages.length} 张`} />
        <ImageGallery images={visibleImages} />
      </Panel>}
    </section>}

    <ProjectDeepWiki project={project} snapshot={wikiSnapshot} />
    <ProjectOperatingPanel projectSlug={project.slug} related={related} />
    </>}

    <div className="flex flex-wrap gap-3"><ButtonLink href="/projects">返回项目列表</ButtonLink><DeleteContentButton type="projects" slug={project.slug} /></div>
  </div>;
}

function getProjectRelations(projectSlug: string) {
  const knowledge = getKnowledge().filter(note => note.relatedProjects?.includes(projectSlug) || note.analysis?.projectLinks?.includes(projectSlug) || note.tags.includes(projectSlug)).slice(0, 6);
  const ideas = getIdeas().filter(idea => idea.analysis?.suggestedProject === projectSlug || idea.tags.includes(projectSlug) || idea.relatedKnowledge?.some(slug => knowledge.some(note => note.slug === slug))).slice(0, 6);
  const tasks = getTasks().filter(task => task.projectSlug === projectSlug || task.sourceSlug === projectSlug).slice(0, 6);
  const logs = getLogs().filter(log => log.tags.includes(projectSlug) || log.content.toLowerCase().includes(projectSlug.toLowerCase())).slice(0, 4);
  return { knowledge, ideas, tasks, logs };
}

function ProjectOperatingPanel({ projectSlug, related }: { projectSlug: string; related: { knowledge: KnowledgeNote[]; ideas: Idea[]; tasks: Task[]; logs: Log[] } }) {
  return <Panel className="p-5 md:p-6">
    <SectionHeader label="Operating Links" value={projectSlug} />
    <div className="grid gap-5 lg:grid-cols-4">
      <RelationColumn title="Knowledge" href="/knowledge" items={related.knowledge.map(note => ({ key: note.slug, title: note.title, meta: note.status }))} />
      <RelationColumn title="Ideas" href="/ideas" items={related.ideas.map(idea => ({ key: idea.slug, title: idea.title, meta: String(idea.score) }))} />
      <RelationColumn title="Tasks" href="/tasks" items={related.tasks.map(task => ({ key: task.slug, title: task.title, meta: task.status }))} />
      <RelationColumn title="Log" href="/log" items={related.logs.map(log => ({ key: log.slug, title: log.title, meta: log.date }))} />
    </div>
  </Panel>;
}

function RelationColumn({ title, href, items }: { title: string; href: string; items: { key: string; title: string; meta: string }[] }) {
  return <div>
    <a href={href} className="caption mb-3 block hover:text-[var(--ink)]">{title} / {items.length}</a>
    <div className="grid gap-2">
      {items.map(item => <div key={item.key} className="border-b border-[var(--border)] pb-2 last:border-b-0">
        <div className="text-sm font-medium leading-5 text-[var(--ink)]">{item.title}</div>
        <div className="caption mt-1">{item.meta}</div>
      </div>)}
      {!items.length && <p className="text-xs leading-5 text-[var(--text-disabled)]">No linked item yet.</p>}
    </div>
  </div>;
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return <div>
    <div className="caption mb-2">{title} / {items.length}</div>
    <ul className="grid gap-2 text-xs leading-5 text-[var(--text-secondary)]">
      {items.slice(0, 6).map(item => <li key={item} className="border-b border-[var(--border)] pb-2 last:border-b-0">{item}</li>)}
      {!items.length && <li className="text-[var(--text-disabled)]">No signal yet.</li>}
    </ul>
  </div>;
}
