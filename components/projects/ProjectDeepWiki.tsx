import type { Project, ProjectWikiSnapshot } from '@/lib/data';
import { generateProjectWiki } from '@/lib/project-wiki';
import { Panel, SectionHeader } from '@/components/UI';
import { ProjectGraph } from '@/components/projects/ProjectGraph';
import { DeepWikiAsk } from '@/components/projects/DeepWikiAsk';

function Confidence({ value }: { value: 'high' | 'medium' | 'low' }) {
  const label = value === 'high' ? '高置信' : value === 'medium' ? '中置信' : '低置信';
  const tone = value === 'high' ? 'text-[var(--success)]' : value === 'medium' ? 'text-[var(--accent)]' : 'text-[var(--text-disabled)]';
  return <span className={`mono rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] uppercase ${tone}`}>{label}</span>;
}

function codeBrief(project: Project, snapshot?: ProjectWikiSnapshot) {
  if (!snapshot) {
    return {
      purpose: project.explanation || project.summary,
      entry: project.source?.startsWith('github:') ? 'pending' : 'none',
      architecture: project.readme?.[0] || 'none',
      inspect: project.nextActions.slice(0, 3)
    };
  }
  return {
    purpose: snapshot.readme?.summary?.[0] || project.explanation || project.summary,
    entry: snapshot.entrypoints.length ? snapshot.entrypoints.slice(0, 4).join(' / ') : snapshot.importantFiles.slice(0, 3).map(file => file.path).join(' / ') || 'none',
    architecture: snapshot.codeInsights?.architectureSummary || `${snapshot.frameworks.join(', ') || snapshot.repo.language || 'Unknown stack'} project with ${snapshot.fileTree.totalFiles} indexed file(s).`,
    inspect: [
      ...(snapshot.codeInsights?.nextQuestions || []),
      ...snapshot.gaps,
      ...project.nextActions
    ].slice(0, 4)
  };
}

export function ProjectDeepWiki({ project, snapshot }: { project: Project; snapshot?: ProjectWikiSnapshot }) {
  const wiki = generateProjectWiki(project, snapshot);
  const canShowRepoLinks = Boolean(wiki.repo && project.visibility !== 'private' && !wiki.snapshot?.repo.private);
  const brief = codeBrief(project, snapshot);

  return <Panel className="p-5 md:p-6">
    <SectionHeader label="DeepWiki / 代码理解" value={<span className="inline-flex items-center gap-2"><Confidence value={wiki.confidence} />{wiki.snapshot ? '真实索引' : '推断草稿'}</span>} />
    <div className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[8px] border border-[var(--border)] bg-white/55 p-4">
        <div className="caption mb-3">这个项目是干嘛的</div>
        <p className="text-sm leading-7 text-[var(--text-secondary)]">{brief.purpose}</p>
        <div className="caption mt-4">核心结构</div>
        <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{brief.architecture}</p>
      </div>
      <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
        <div className="caption mb-3">从哪里开始看</div>
        <p className="mono text-[11px] leading-6 text-[var(--ink)]">{brief.entry}</p>
        <div className="caption mt-4">下一轮 DeepWiki 应该回答</div>
        <ul className="mt-2 grid gap-2">
          {brief.inspect.map(item => <li key={item} className="text-xs leading-5 text-[var(--text-secondary)]">{item}</li>)}
        </ul>
      </div>
    </div>
    <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
      <div className="grid gap-4">
        <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">已知事实</div>
          <ul className="space-y-2">
            {wiki.facts.map(fact => <li key={fact} className="text-sm leading-6 text-[var(--text-secondary)]">{fact}</li>)}
          </ul>
          {canShowRepoLinks && wiki.repo && <div className="mt-4 flex flex-wrap gap-2">
            <a href={wiki.repo.url} target="_blank" className="mono rounded-full border border-[var(--border-visible)] px-3 py-2 text-[10px] uppercase text-[var(--text-secondary)] transition hover:border-[var(--ink)] hover:text-[var(--ink)]">GitHub repo</a>
            <a href={wiki.repo.deepwikiUrl} target="_blank" className="mono primary-action rounded-full px-3 py-2 text-[10px] uppercase transition">Open DeepWiki</a>
          </div>}
        </div>

        {wiki.snapshot && <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="caption mb-3">仓库读数</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="doto text-5xl leading-none text-[var(--ink)]">{wiki.snapshot.fileTree.totalFiles}</div>
              <div className="caption mt-1">files</div>
            </div>
            <div>
              <div className="doto text-5xl leading-none text-[var(--ink)]">{wiki.snapshot.frameworks.length}</div>
              <div className="caption mt-1">frameworks</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {wiki.snapshot.frameworks.map(item => <span key={item} className="mono rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] uppercase text-[var(--text-secondary)]">{item}</span>)}
          </div>
        </div>}

        {wiki.snapshot?.codeInsights && <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">源码洞察</div>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{wiki.snapshot.codeInsights.architectureSummary}</p>
          <div className="caption mt-4">分析文件 / {wiki.snapshot.codeInsights.filesAnalyzed.length}</div>
          <div className="mt-2 grid gap-1">
            {wiki.snapshot.codeInsights.filesAnalyzed.slice(0, 6).map(file => <span key={file.path} className="mono text-[10px] text-[var(--text-disabled)]">{file.path}</span>)}
          </div>
        </div>}

        {wiki.snapshot?.codeInsights?.dataFlow.length ? <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="caption mb-3">数据流 / 工作流</div>
          <ol className="space-y-3">
            {wiki.snapshot.codeInsights.dataFlow.map((item, index) => <li key={item} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-[var(--text-secondary)]">
              <span className="doto text-2xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
              <span>{item}</span>
            </li>)}
          </ol>
        </div> : null}

        {wiki.snapshot && <DeepWikiAsk slug={project.slug} files={wiki.snapshot.importantFiles.map(file => file.path)} />}

        <div className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
          <div className="caption mb-3">Next</div>
          <ol className="space-y-3">
            {wiki.next.map((item, index) => <li key={item} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-[var(--text-secondary)]">
              <span className="doto text-2xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
              <span>{item}</span>
            </li>)}
          </ol>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">推断模块</div>
          <div className="grid gap-3">
            {wiki.inferredModules.map(module => <div key={module.name} className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{module.name}</h3>
                <Confidence value={module.confidence} />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{module.evidence}</p>
            </div>)}
          </div>
        </div>

        {wiki.snapshot?.importantFiles.length ? <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">关键文件</div>
          <div className="grid gap-2">
            {wiki.snapshot.importantFiles.map(file => <div key={file.path} className="grid gap-1 border-b border-[var(--border)] pb-2 last:border-b-0 last:pb-0">
              <span className="mono text-[11px] text-[var(--ink)]">{file.path}</span>
              <span className="text-xs leading-5 text-[var(--text-secondary)]">{file.reason}</span>
            </div>)}
          </div>
        </div> : null}

        {wiki.snapshot?.codeInsights?.modules.length ? <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
          <div className="caption mb-3">LLM 模块摘要</div>
          <div className="grid gap-3">
            {wiki.snapshot.codeInsights.modules.map(module => <div key={module.name} className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
              <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{module.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{module.summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {module.files.slice(0, 4).map(file => <span key={file} className="mono rounded-full border border-[var(--border-visible)] px-2 py-1 text-[9px] uppercase text-[var(--text-disabled)]">{file}</span>)}
              </div>
            </div>)}
          </div>
        </div> : null}

        {wiki.snapshot?.codeInsights?.risks.length ? <div className="rounded-[8px] border border-[var(--danger)]/35 bg-white/45 p-4">
          <div className="caption mb-3 text-[var(--text-primary)]">风险点</div>
          <div className="grid gap-3">
            {wiki.snapshot.codeInsights.risks.map(risk => <div key={`${risk.level}-${risk.title}`} className="border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold leading-tight text-[var(--ink)]">{risk.title}</h3>
                <span className="mono rounded-full border border-[var(--border-visible)] px-2 py-1 text-[9px] uppercase text-[var(--danger)]">{risk.level}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{risk.detail}</p>
            </div>)}
          </div>
        </div> : null}

        <ProjectGraph edges={wiki.graph} />
      </div>
    </div>

    {wiki.gaps.length ? <div className="mt-5 rounded-[8px] border border-[var(--warning)]/45 bg-white/45 p-4">
      <div className="caption mb-2 text-[var(--text-primary)]">Gaps</div>
      <ul className="grid gap-2 md:grid-cols-2">
        {wiki.gaps.map(gap => <li key={gap} className="text-sm leading-6 text-[var(--text-secondary)]">{gap}</li>)}
      </ul>
    </div> : null}
  </Panel>;
}
