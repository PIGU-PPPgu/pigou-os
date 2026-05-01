'use client';

import { MouseEvent, WheelEvent, useMemo, useRef, useState } from 'react';
import { Panel, SectionHeader, StatusBadge } from '@/components/UI';
import { KnowledgeCapture } from '@/components/KnowledgeCapture';
import { AuthOnly, DeleteContentButton, LoginRequired } from '@/components/auth/AuthControls';
import type { KnowledgeNote, KnowledgePlatform } from '@/lib/data';

const typeLabel: Record<KnowledgeNote['type'] | 'all', string> = {
  all: '全部',
  source: '资料',
  insight: '洞察',
  decision: '决策',
  pattern: '模式',
  question: '问题',
  asset: '素材'
};

const platformLabel: Record<KnowledgePlatform | 'all', string> = {
  all: '全部平台',
  github: 'GitHub',
  wechat: '微信',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  bilibili: 'Bilibili',
  website: '网站',
  paper: '论文/PDF',
  manual: '手动',
  other: '其他'
};

const confidenceLabel: Record<KnowledgeNote['confidence'] | 'all', string> = {
  all: '全部置信',
  low: '低可信度',
  medium: '中可信度',
  high: '高可信度'
};

type SortKey = 'updated' | 'confidence' | 'related' | 'raw' | 'platform';
type GraphNode = { id: string; title: string; kind: 'note' | 'topic' | 'project'; x: number; y: number };

const confidenceWeight: Record<KnowledgeNote['confidence'], number> = { high: 3, medium: 2, low: 1 };

export function KnowledgeBoard({ notes: initialNotes }: { notes: KnowledgeNote[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [type, setType] = useState<KnowledgeNote['type'] | 'all'>('all');
  const [status, setStatus] = useState<KnowledgeNote['status'] | 'all'>('all');
  const [platform, setPlatform] = useState<KnowledgePlatform | 'all'>('all');
  const [confidence, setConfidence] = useState<KnowledgeNote['confidence'] | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(initialNotes[0]?.slug || '');
  const [state, setState] = useState('ready');

  const filtered = useMemo(() => notes
    .filter(note => {
      const haystack = [note.title, note.summary, note.next, note.analysis?.intent, note.analysis?.usefulness, ...note.keyPoints, ...note.tags, ...(note.relatedProjects || [])].join('\n').toLowerCase();
      return (type === 'all' || note.type === type)
        && (status === 'all' || note.status === status)
        && (platform === 'all' || (note.platform || 'manual') === platform)
        && (confidence === 'all' || note.confidence === confidence)
        && (!query.trim() || haystack.includes(query.toLowerCase()));
    })
    .sort((a, b) => {
      if (sort === 'confidence') return confidenceWeight[b.confidence] - confidenceWeight[a.confidence] || b.updated.localeCompare(a.updated);
      if (sort === 'related') return relationCount(b) - relationCount(a) || b.updated.localeCompare(a.updated);
      if (sort === 'raw') return Number(a.status === 'raw') - Number(b.status === 'raw') || b.updated.localeCompare(a.updated);
      if (sort === 'platform') return (a.platform || 'manual').localeCompare(b.platform || 'manual') || b.updated.localeCompare(a.updated);
      return b.updated.localeCompare(a.updated);
    }), [notes, query, status, type, platform, confidence, sort]);

  const selected = notes.find(note => note.slug === selectedSlug) || filtered[0] || notes[0];
  const clusters = useMemo(() => buildClusters(notes), [notes]);

  async function reanalyze(note: KnowledgeNote) {
    setState('analyzing');
    const response = await fetch('/api/knowledge/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug: note.slug })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setNotes(current => current.map(item => item.slug === note.slug ? result.note : item));
      setSelectedSlug(result.note.slug);
      setState('analysis saved');
    } else {
      setState(result?.message || 'analysis failed');
    }
  }

  async function createTask(note: KnowledgeNote) {
    setState('creating task');
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ sourceType: 'knowledge', sourceSlug: note.slug, priority: note.confidence === 'high' ? 'P0' : 'P1' })
    });
    const result = await response.json().catch(() => null);
    setState(response.ok && result?.ok ? `task created: ${result.task.title}` : result?.message || 'task failed');
  }

  async function patchNote(note: KnowledgeNote, patch: Partial<KnowledgeNote>) {
    setState('updating note');
    const response = await fetch('/api/knowledge', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug: note.slug, ...patch })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setNotes(current => current.map(item => item.slug === note.slug ? result.note : item));
      setSelectedSlug(result.note.slug);
      setState(`updated: ${result.note.status}`);
    } else {
      setState(result?.message || 'update failed');
    }
  }

  return <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
    <div className="grid gap-5">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Knowledge Index" value={`${filtered.length} visible / ${notes.length} total`} />
        <div className="mb-5 grid gap-3 md:grid-cols-5">
          <select value={platform} onChange={event => setPlatform(event.target.value as KnowledgePlatform | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm outline-none"><option value="all">{platformLabel.all}</option>{Object.entries(platformLabel).filter(([key]) => key !== 'all').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={type} onChange={event => setType(event.target.value as KnowledgeNote['type'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm outline-none">{Object.entries(typeLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={status} onChange={event => setStatus(event.target.value as KnowledgeNote['status'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm outline-none"><option value="all">全部状态</option><option value="raw">raw</option><option value="processed">processed</option><option value="linked">linked</option></select>
          <select value={confidence} onChange={event => setConfidence(event.target.value as KnowledgeNote['confidence'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm outline-none">{Object.entries(confidenceLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={sort} onChange={event => setSort(event.target.value as SortKey)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm outline-none"><option value="updated">最新优先</option><option value="confidence">高置信优先</option><option value="related">最多关联</option><option value="raw">待处理优先</option><option value="platform">平台分组</option></select>
        </div>
        <input value={query} onChange={event => setQuery(event.target.value)} className="mb-3 min-h-10 w-full rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="Search notes, AI analysis, tags, project links..." />
        <div>
          {filtered.map(note => <section key={note.slug} className={`cursor-pointer border-b border-[var(--border)] py-5 last:border-b-0 md:px-3 ${selected?.slug === note.slug ? 'bg-white/45' : ''}`} onClick={() => setSelectedSlug(note.slug)}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{note.title}</h3>
              <div className="flex shrink-0 flex-wrap justify-end gap-2"><StatusBadge status={note.status} /><DeleteContentButton type="knowledge" slug={note.slug} onDeleted={() => setNotes(current => current.filter(item => item.slug !== note.slug))} /></div>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">{note.summary}</p>
            {note.analysis && <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-white/45 px-4 py-3 text-sm leading-6 text-[var(--text-primary)]"><span className="caption mr-2">AI</span>{note.analysis.usefulness}</div>}
            <div className="mono mt-4 flex flex-wrap gap-2 text-[10px] uppercase text-[var(--text-disabled)]">
              <span className="rounded-full border border-[var(--border-visible)] px-3 py-1">{platformLabel[note.platform || 'manual']}</span>
              <span className="rounded-full border border-[var(--border-visible)] px-3 py-1">{typeLabel[note.type]}</span>
              <span className="rounded-full border border-[var(--border-visible)] px-3 py-1">{confidenceLabel[note.confidence]}</span>
              {note.tags.slice(0, 5).map(tag => <button key={tag} type="button" onClick={event => { event.stopPropagation(); setQuery(tag); }}>#{tag}</button>)}
            </div>
          </section>)}
          {!filtered.length && <p className="py-8 text-sm leading-6 text-[var(--text-secondary)]">No notes match this filter.</p>}
        </div>
      </Panel>
    </div>

    <div className="grid gap-5">
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Quick Capture" value="link / text / AI" />
        <AuthOnly fallback={<LoginRequired />}>
          <KnowledgeCapture onCaptured={note => { setNotes(current => [note, ...current]); setSelectedSlug(note.slug); }} />
        </AuthOnly>
      </Panel>

      {selected && <KnowledgeDetail note={selected} state={state} onAnalyze={reanalyze} onCreateTask={createTask} onPatch={patchNote} />}

      <details className="rounded-[8px] border border-[var(--border-visible)] bg-white/35 p-5">
        <summary className="caption cursor-pointer">Open local mini graph</summary>
        <div className="mt-4">
          <KnowledgeGraph notes={notes} selectedSlug={selected?.slug} onSelect={setSelectedSlug} />
        </div>
      </details>

      <details className="rounded-[8px] border border-[var(--border-visible)] bg-white/35 p-5">
        <summary className="caption cursor-pointer">Open topic clusters / {clusters.length}</summary>
        <div className="mt-4 grid gap-3">
          {clusters.slice(0, 8).map(cluster => <button key={cluster.name} type="button" onClick={() => setQuery(cluster.name)} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border)] pb-3 text-left last:border-b-0 last:pb-0">
            <span className="text-sm font-medium text-[var(--ink)]">{cluster.name}</span>
            <span className="doto text-3xl leading-none text-[var(--ink)]">{cluster.count}</span>
          </button>)}
        </div>
      </details>
    </div>
  </section>;
}

function relationCount(note: KnowledgeNote) {
  return (note.relatedProjects?.length || 0) + (note.similar?.length || 0) + (note.analysis?.projectLinks.length || 0) + (note.analysis?.ideaLinks.length || 0);
}

function KnowledgeDetail({ note, state, onAnalyze, onCreateTask, onPatch }: { note: KnowledgeNote; state: string; onAnalyze: (note: KnowledgeNote) => void; onCreateTask: (note: KnowledgeNote) => void; onPatch: (note: KnowledgeNote, patch: Partial<KnowledgeNote>) => void }) {
  return <Panel className="p-5 md:p-6">
    <SectionHeader label="Note Detail" value={note.analyzedAt || note.updated} />
    <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{note.title}</h3>
    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{note.summary}</p>
    <div className="mt-5 grid gap-3">
      <Block title="AI Intent" body={note.analysis?.intent || '尚未生成 AI intent。'} />
      <Block title="Usefulness" body={note.analysis?.usefulness || '尚未生成 usefulness。'} />
      <Block title="Relation Reasoning" body={note.analysis?.relationReasoning || '尚未生成关系解释。'} />
    </div>
    {note.analysis?.actionSuggestions.length ? <div className="mt-5">
      <div className="caption mb-2">AI Action Suggestions</div>
      <ol className="grid gap-2">
        {note.analysis.actionSuggestions.map((item, index) => <li key={item} className="grid grid-cols-[28px_1fr] gap-3 text-sm leading-6 text-[var(--text-secondary)]"><span className="doto text-2xl leading-none">{index + 1}</span>{item}</li>)}
      </ol>
    </div> : null}
    {note.rawExtract && <details className="mt-5 rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
      <summary className="caption cursor-pointer">Raw Extract</summary>
      <p className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-6 text-[var(--text-secondary)]">{note.rawExtract}</p>
    </details>}
    {note.similar?.length ? <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-white/45 px-4 py-3">
      <div className="caption mb-2">Similar Notes</div>
      <div className="grid gap-1">{note.similar.slice(0, 4).map(item => <span key={item.slug} className="text-xs leading-5 text-[var(--text-secondary)]">{item.title}<span className="caption ml-2">{Math.round(item.score * 100)}%</span></span>)}</div>
    </div> : null}
    <AuthOnly>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onAnalyze(note)} className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">reanalyze</button>
        <button type="button" onClick={() => onCreateTask(note)} className="mono inline-flex min-h-10 items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">create task</button>
        {note.status !== 'processed' && <button type="button" onClick={() => onPatch(note, { status: 'processed' })} className="mono inline-flex min-h-10 items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">mark processed</button>}
        {note.status !== 'linked' && <button type="button" onClick={() => onPatch(note, { status: 'linked' })} className="mono inline-flex min-h-10 items-center rounded-full border border-[var(--success)] px-4 text-[10px] uppercase text-[var(--success)]">mark linked</button>}
        <span className="caption">{state}</span>
      </div>
    </AuthOnly>
    {note.sourceUrl && <a href={note.sourceUrl} target="_blank" rel="noreferrer" className="mono mt-4 inline-flex min-h-10 items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">open source</a>}
  </Panel>;
}

function Block({ title, body }: { title: string; body: string }) {
  return <div className="border-b border-[var(--border)] pb-3 last:border-b-0">
    <div className="caption mb-1">{title}</div>
    <p className="text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
  </div>;
}

function buildClusters(notes: KnowledgeNote[]) {
  const counts = new Map<string, number>();
  for (const note of notes) for (const key of [...note.tags, ...(note.relatedProjects || []), ...(note.analysis?.projectLinks || []), ...(note.analysis?.ideaLinks || [])]) counts.set(key, (counts.get(key) || 0) + 1);
  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildGraph(notes: KnowledgeNote[]) {
  const visibleNotes = notes.slice(0, 12);
  const topics = buildClusters(visibleNotes).slice(0, 12);
  const nodes: GraphNode[] = [
    ...visibleNotes.map((note, index) => ({ id: note.slug, title: note.title, kind: 'note' as const, x: 90 + (index % 2) * 260, y: 80 + Math.floor(index / 2) * 100 })),
    ...topics.map((topic, index) => ({ id: topic.name, title: topic.name, kind: topic.name.includes('-') ? 'project' as const : 'topic' as const, x: 620 + (index % 2) * 190, y: 80 + Math.floor(index / 2) * 92 }))
  ];
  const topicIds = new Set(topics.map(topic => topic.name));
  const edges = visibleNotes.flatMap(note => [...note.tags, ...(note.relatedProjects || []), ...(note.analysis?.projectLinks || []), ...(note.analysis?.ideaLinks || [])].filter(item => topicIds.has(item)).slice(0, 5).map(item => ({ from: note.slug, to: item })));
  return { nodes, edges };
}

function KnowledgeGraph({ notes, selectedSlug, onSelect }: { notes: KnowledgeNote[]; selectedSlug?: string; onSelect: (slug: string) => void }) {
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const graph = useMemo(() => buildGraph(notes), [notes]);
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));

  function zoom(next: number) {
    setScale(Math.max(.45, Math.min(2.6, Number(next.toFixed(2)))));
  }

  function wheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(scale + (event.deltaY > 0 ? -.08 : .08));
  }

  function startDrag(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function moveDrag(event: MouseEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setPan({ x: dragRef.current.panX + event.clientX - dragRef.current.x, y: dragRef.current.panY + event.clientY - dragRef.current.y });
  }

  const canvas = <div onWheel={wheel} onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={() => { dragRef.current = null; }} onMouseLeave={() => { dragRef.current = null; }} className={`${full ? 'h-[78vh]' : 'h-[420px]'} relative cursor-grab overflow-hidden rounded-[8px] border border-[var(--border-visible)] bg-[#f7f7f1] active:cursor-grabbing`}>
    <div className="absolute left-0 top-0 h-[820px] w-[1080px] origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
      <svg className="absolute inset-0 h-full w-full">
        {graph.edges.map(edge => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return <line key={`${edge.from}-${edge.to}`} x1={from.x + 75} y1={from.y + 22} x2={to.x + 72} y2={to.y + 20} stroke="rgba(10,10,9,.34)" strokeWidth="1" />;
        })}
      </svg>
      {graph.nodes.map(node => {
        const active = node.id === selectedSlug;
        const note = notes.find(item => item.slug === node.id);
        return <button key={node.id} type="button" onClick={() => note && onSelect(note.slug)} className={`absolute max-w-[190px] rounded-[8px] border px-3 py-2 text-left shadow-sm transition ${node.kind === 'note' ? 'bg-white/90' : 'bg-[var(--ink)] text-white'} ${active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--border-visible)]'}`} style={{ left: node.x, top: node.y }}>
          <span className="caption block">{node.kind}</span>
          <span className="block truncate text-xs font-semibold leading-5">{node.title}</span>
        </button>;
      })}
    </div>
  </div>;

  return <div className="grid gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="caption">nodes {graph.nodes.length} / edges {graph.edges.length}</div>
      <div className="mono flex gap-2 text-[10px] uppercase">
        <button type="button" onClick={() => zoom(scale - .15)} className="rounded-full border border-[var(--border-visible)] px-3 py-1">-</button>
        <button type="button" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} className="rounded-full border border-[var(--border-visible)] px-3 py-1">reset</button>
        <button type="button" onClick={() => zoom(scale + .15)} className="rounded-full border border-[var(--border-visible)] px-3 py-1">+</button>
        <button type="button" onClick={() => setFull(true)} className="rounded-full border border-[var(--border-visible)] px-3 py-1">fullscreen</button>
      </div>
    </div>
    {canvas}
    {full && <div className="fixed inset-0 z-50 grid bg-black/80 p-4 backdrop-blur-sm">
      <div className="mb-3 flex justify-end"><button type="button" onClick={() => setFull(false)} className="mono rounded-full border border-white/35 px-4 py-2 text-[11px] uppercase text-white">close</button></div>
      <div className="overflow-hidden rounded-[8px] bg-[var(--surface)] p-3">{canvas}</div>
    </div>}
  </div>;
}
