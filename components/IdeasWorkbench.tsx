'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthOnly, DeleteContentButton, LoginRequired } from '@/components/auth/AuthControls';
import { Label, MiniMeter, Panel, Pill, SectionHeader, StatusBadge } from '@/components/UI';
import type { Idea } from '@/lib/data';

const statusLabel: Record<Idea['status'] | 'all' | 'high', string> = {
  all: '全部',
  high: '高信号',
  spark: '火花',
  validated: '已验证',
  building: '推进中',
  killed: '放弃'
};

function ideaBucket(idea: Idea) {
  if (idea.score >= 80) return 'high';
  if (idea.score >= 65) return 'warm';
  return 'cold';
}

export function IdeasWorkbench({ ideas: initialIdeas }: { ideas: Idea[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [filter, setFilter] = useState<Idea['status'] | 'all' | 'high'>('all');
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(initialIdeas[0]?.slug || '');
  const [state, setState] = useState('ready');

  const filtered = useMemo(() => ideas
    .filter(idea => filter === 'all' || (filter === 'high' ? idea.score >= 75 : idea.status === filter))
    .filter(idea => {
      const haystack = [idea.title, idea.summary, idea.next, idea.analysis?.opportunity, idea.analysis?.userPain, ...(idea.analysis?.risks || []), ...idea.tags].join('\n').toLowerCase();
      return !query.trim() || haystack.includes(query.toLowerCase());
    })
    .sort((a, b) => b.score - a.score), [filter, ideas, query]);

  const selected = ideas.find(idea => idea.slug === selectedSlug) || filtered[0] || ideas[0];
  const high = ideas.filter(idea => idea.score >= 75).length;
  const incubating = ideas.filter(idea => idea.status === 'validated' || idea.status === 'building').length;
  const avgScore = ideas.length ? Math.round(ideas.reduce((sum, idea) => sum + idea.score, 0) / ideas.length) : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('scoring idea');
    const target = event.currentTarget;
    const form = new FormData(target);
    const input = String(form.get('input') || '').trim();
    const response = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ input })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setState(result?.message || '写入失败，请确认已经登录。');
      return;
    }

    formRef.current?.reset();
    setIdeas(current => [result.idea, ...current]);
    setSelectedSlug(result.idea.slug);
    setState(result.message || `已写入：${result.idea.title}`);
    router.refresh();
  }

  async function reanalyze(idea: Idea) {
    setState('reanalyzing idea');
    const response = await fetch('/api/ideas/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug: idea.slug })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setIdeas(current => current.map(item => item.slug === idea.slug ? result.idea : item));
      setSelectedSlug(result.idea.slug);
      setState('analysis saved');
    } else {
      setState(result?.message || 'analysis failed');
    }
  }

  async function createTask(idea: Idea) {
    setState('creating task');
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ sourceType: 'idea', sourceSlug: idea.slug, priority: idea.score >= 80 ? 'P0' : 'P1' })
    });
    const result = await response.json().catch(() => null);
    setState(response.ok && result?.ok ? `task created: ${result.task.title}` : result?.message || 'task failed');
  }

  async function promoteIdea(idea: Idea) {
    setState('promoting idea');
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ ideaSlug: idea.slug })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setIdeas(current => current.map(item => item.slug === idea.slug ? { ...item, status: 'building', analysis: item.analysis ? { ...item.analysis, suggestedProject: result.project.slug } : item.analysis } : item));
      setState(`project created: ${result.project.title}`);
      router.refresh();
    } else {
      setState(result?.message || 'promote failed');
    }
  }

  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Label>Ideas / Radar</Label>
          <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">What is worth incubating?</h2>
        </div>
        <div className="grid grid-cols-3 gap-5 text-right">
          <div><div className="doto text-6xl leading-none text-[var(--ink)]">{String(ideas.length).padStart(2, '0')}</div><div className="caption mt-1">ideas</div></div>
          <div><div className="doto text-6xl leading-none text-[var(--ink)]">{String(high).padStart(2, '0')}</div><div className="caption mt-1">high</div></div>
          <div><div className="doto text-6xl leading-none text-[var(--ink)]">{avgScore}</div><div className="caption mt-1">avg</div></div>
        </div>
      </div>
    </Panel>

    <section className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
      <div className="grid gap-5">
        <Panel className="p-5 md:p-6">
          <SectionHeader label="Quick Capture" value="AI scoring" />
          <AuthOnly fallback={<LoginRequired />}>
            <form ref={formRef} onSubmit={submit} className="grid gap-4">
              <textarea name="input" required rows={7} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--ink)]" placeholder="写一个想法、用户场景、产品机会或模糊判断，AI 会先打分并生成下一步实验。" />
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="primary-action mono inline-flex min-h-11 items-center rounded-full px-6 text-[12px] uppercase transition">capture idea</button>
                <span className="caption">{state}</span>
              </div>
            </form>
          </AuthOnly>
        </Panel>

        <details className="rounded-[8px] border border-[var(--border-visible)] bg-white/35 p-5">
          <summary className="caption cursor-pointer">Open incubation queue / {incubating} active signal(s)</summary>
          <div className="mt-4 grid gap-5">
            <MiniMeter value={Math.min(100, high * 20)} label="high signal density" />
            <MiniMeter value={Math.min(100, incubating * 25)} label="incubation load" />
            <div className="grid gap-3">
              {ideas.filter(idea => idea.score >= 75).slice(0, 4).map(idea => <button key={idea.slug} type="button" onClick={() => setSelectedSlug(idea.slug)} className="grid grid-cols-[54px_1fr_auto] items-center gap-3 border-b border-[var(--border)] pb-3 text-left last:border-b-0 last:pb-0">
                <span className="doto text-3xl leading-none text-[var(--ink)]">{idea.score}</span>
                <span className="text-sm leading-6 text-[var(--text-primary)]">{idea.title}</span>
                <span className="caption">{idea.status}</span>
              </button>)}
            </div>
          </div>
        </details>

        <Panel className="p-5 md:p-6">
          <SectionHeader label="Idea Index" value={`${filtered.length} visible`} />
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {(['all', 'high', 'spark', 'validated', 'building', 'killed'] as const).map(item => <button key={item} type="button" onClick={() => setFilter(item)}><Pill active={filter === item}>{statusLabel[item]}</Pill></button>)}
            <input value={query} onChange={event => setQuery(event.target.value)} className="min-h-10 min-w-[220px] flex-1 rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="Search ideas, AI analysis, tags..." />
          </div>
          <div>
            {filtered.map(idea => <section key={idea.slug} onClick={() => setSelectedSlug(idea.slug)} className={`cursor-pointer border-b border-[var(--border)] py-5 last:border-b-0 md:px-3 ${selected?.slug === idea.slug ? 'bg-white/45' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={idea.status} /><span className="caption">{ideaBucket(idea)}</span></div>
                  <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{idea.title}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-3"><span className="doto text-4xl text-[var(--ink)]">{idea.score}</span><DeleteContentButton type="ideas" slug={idea.slug} onDeleted={() => setIdeas(current => current.filter(item => item.slug !== idea.slug))} /></div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{idea.summary}</p>
              {idea.analysis && <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-white/45 px-4 py-3 text-sm text-[var(--text-primary)]"><span className="caption mr-2">AI</span>{idea.analysis.opportunity}</div>}
              <div className="mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] uppercase text-[var(--text-disabled)]">{idea.tags.map(tag => <button key={tag} type="button" onClick={event => { event.stopPropagation(); setQuery(tag); }}>#{tag}</button>)}</div>
            </section>)}
            {!filtered.length && <p className="py-8 text-sm leading-6 text-[var(--text-secondary)]">No idea matches this filter.</p>}
          </div>
        </Panel>
      </div>

      {selected && <Panel className="p-5 md:p-6">
        <SectionHeader label="Idea Detail" value={selected.analyzedAt || selected.updated} />
        <div className="flex flex-wrap items-center gap-3"><StatusBadge status={selected.status} /><span className="doto text-5xl leading-none text-[var(--ink)]">{selected.score}</span></div>
        <h3 className="mt-4 text-4xl font-semibold leading-tight text-[var(--ink)]">{selected.title}</h3>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{selected.summary}</p>
        <div className="mt-5 grid gap-3">
          <Detail label="User Pain" value={selected.analysis?.userPain || '尚未生成用户痛点分析。'} />
          <Detail label="Opportunity" value={selected.analysis?.opportunity || '尚未生成机会判断。'} />
          <Detail label="Feasibility" value={selected.analysis?.feasibility || '尚未生成可行性判断。'} />
          <Detail label="Next Experiment" value={selected.analysis?.nextExperiment || selected.next || '尚未定义下一步实验。'} />
        </div>
        {selected.analysis?.risks.length ? <div className="mt-5">
          <div className="caption mb-2">Risks</div>
          <ul className="grid gap-2">{selected.analysis.risks.map(risk => <li key={risk} className="text-sm leading-6 text-[var(--text-secondary)]">{risk}</li>)}</ul>
        </div> : null}
        {selected.relatedKnowledge?.length ? <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-white/45 px-4 py-3"><div className="caption mb-2">Evidence Links</div><div className="mono flex flex-wrap gap-2 text-[10px] uppercase text-[var(--text-disabled)]">{selected.relatedKnowledge.map(slug => <span key={slug}>/{slug}</span>)}</div></div> : null}
        <AuthOnly>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => reanalyze(selected)} className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">reanalyze</button>
            <button type="button" onClick={() => createTask(selected)} className="mono inline-flex min-h-10 items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">create task</button>
            <button type="button" onClick={() => promoteIdea(selected)} className="mono inline-flex min-h-10 items-center rounded-full border border-[var(--accent)] px-4 text-[10px] uppercase text-[var(--accent)] hover:border-[var(--ink)]">promote project</button>
            <span className="caption">{state}</span>
          </div>
        </AuthOnly>
      </Panel>}
    </section>
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[var(--border)] pb-3 last:border-b-0">
    <div className="caption mb-1">{label}</div>
    <p className="text-sm leading-6 text-[var(--text-secondary)]">{value}</p>
  </div>;
}
