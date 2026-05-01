'use client';

import { useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, WheelEvent } from 'react';
import Link from 'next/link';
import { AuthOnly } from '@/components/auth/AuthControls';
import { Label, Panel, SectionHeader } from '@/components/UI';
import type { LlmWikiGraph } from '@/lib/data';

type NodeType = LlmWikiGraph['nodes'][number]['type'];
type EdgeType = LlmWikiGraph['edges'][number]['type'];
type Lens = 'focus' | 'projects' | 'ideas' | 'knowledge' | 'tasks' | 'all';
type NodePoint = { x: number; y: number };
type GraphNode = LlmWikiGraph['nodes'][number];
type GraphEdge = LlmWikiGraph['edges'][number];
type RelationGroup = { type: EdgeType; edges: { edge: GraphEdge; other?: GraphNode; direction: 'out' | 'in' }[] };

const nodeLabels: Record<NodeType | 'all', string> = {
  all: 'All nodes',
  knowledge: 'Knowledge',
  idea: 'Ideas',
  project: 'Projects',
  task: 'Tasks',
  topic: 'Topics'
};

const edgeLabels: Record<EdgeType | 'all', string> = {
  all: 'All edges',
  supports: 'Supports',
  inspires: 'Inspires',
  blocks: 'Blocks',
  validates: 'Validates',
  becomes: 'Becomes',
  relates: 'Relates'
};

const lensLabels: Record<Lens, string> = {
  focus: 'Focus map',
  projects: 'Projects',
  ideas: 'Ideas',
  knowledge: 'Knowledge',
  tasks: 'Tasks',
  all: 'All signals'
};

const confidenceLabels: Record<LlmWikiGraph['edges'][number]['confidence'] | 'all', string> = {
  all: 'All confidence',
  high: 'High only',
  medium: 'Medium+',
  low: 'Low+'
};

const confidenceRank: Record<LlmWikiGraph['edges'][number]['confidence'], number> = { low: 1, medium: 2, high: 3 };
const lensNodeType: Partial<Record<Lens, NodeType>> = { projects: 'project', ideas: 'idea', knowledge: 'knowledge', tasks: 'task' };

export function LlmWikiWorkbench({ graph: initialGraph }: { graph: LlmWikiGraph }) {
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const panMovedRef = useRef(false);
  const nodeDragRef = useRef<{ id: string; startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [graph, setGraph] = useState(initialGraph);
  const [selectedId, setSelectedId] = useState(initialGraph.nodes.find(node => node.type === 'topic')?.id || initialGraph.nodes[0]?.id || '');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>('focus');
  const [nodeType, setNodeType] = useState<NodeType | 'all'>('all');
  const [edgeType, setEdgeType] = useState<EdgeType | 'all'>('all');
  const [confidence, setConfidence] = useState<LlmWikiGraph['edges'][number]['confidence'] | 'all'>('medium');
  const [query, setQuery] = useState('');
  const [scale, setScale] = useState(.78);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Record<string, NodePoint>>({});
  const [full, setFull] = useState(false);
  const [message, setMessage] = useState('ready');
  const [taskMessage, setTaskMessage] = useState('ready');

  const nodeMap = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes]);
  const selected = nodeMap.get(selectedId) || graph.nodes.find(node => node.type === 'topic') || graph.nodes[0];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedRelated = new Set<string>();
    if (focusId) {
      for (const edge of graph.edges) {
        if (edge.from === focusId) selectedRelated.add(edge.to);
        if (edge.to === focusId) selectedRelated.add(edge.from);
      }
    }

    const requiredType = lensNodeType[lens];
    const pool = graph.nodes
      .filter(node => nodeType === 'all' || node.type === nodeType)
      .filter(node => !requiredType || node.type === requiredType || node.type === 'topic' || selectedRelated.has(node.id))
      .filter(node => {
        if (!q) return true;
        return [node.title, node.summary, node.status, node.platform, node.id].filter(Boolean).join('\n').toLowerCase().includes(q);
      })
      .sort((a, b) => nodeRank(b, selectedRelated, lens) - nodeRank(a, selectedRelated, lens));

    const cap = lens === 'all' ? 48 : lens === 'focus' ? 30 : 34;
    const picked = new Map<string, LlmWikiGraph['nodes'][number]>();

    if (lens === 'focus') {
      for (const node of graph.nodes.filter(item => item.type === 'topic').slice(0, 7)) picked.set(node.id, node);
      for (const node of graph.nodes.filter(item => item.type === 'project' && (item.status === 'building' || item.status === 'shipped')).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 7)) picked.set(node.id, node);
      for (const node of graph.nodes.filter(item => item.type === 'idea' && (item.score || 0) >= 70).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6)) picked.set(node.id, node);
      for (const node of graph.nodes.filter(item => item.type === 'task' && item.status !== 'done' && item.status !== 'archived').slice(0, 5)) picked.set(node.id, node);
      for (const node of graph.nodes.filter(item => item.type === 'knowledge' && (item.status === 'linked' || item.status === 'processed')).slice(0, 6)) picked.set(node.id, node);
    }

    for (const node of pool) {
      if (picked.size >= cap && !selectedRelated.has(node.id) && node.id !== selectedId) continue;
      picked.set(node.id, node);
    }
    if (selected) picked.set(selected.id, selected);
    if (focusId) {
      const focusNode = nodeMap.get(focusId);
      if (focusNode) picked.set(focusNode.id, focusNode);
    }
    for (const id of Array.from(selectedRelated).slice(0, 12)) {
      const node = nodeMap.get(id);
      if (node) picked.set(id, node);
    }

    const ids = new Set(picked.keys());
    const edges = graph.edges
      .filter(edge => ids.has(edge.from) && ids.has(edge.to))
      .filter(edge => edgeType === 'all' || edge.type === edgeType)
      .filter(edge => confidence === 'all' || confidenceRank[edge.confidence] >= confidenceRank[confidence])
      .sort((a, b) => edgeRank(b, focusId || selectedId) - edgeRank(a, focusId || selectedId))
      .slice(0, lens === 'all' ? 90 : 56);

    return { nodes: Array.from(picked.values()), edges };
  }, [confidence, edgeType, focusId, graph.edges, graph.nodes, lens, nodeMap, nodeType, query, selected, selectedId]);

  const selectedEdges = useMemo(() => {
    if (!selected) return [];
    return graph.edges
      .filter(edge => edge.from === selected.id || edge.to === selected.id)
      .sort((a, b) => edgeRank(b, selected.id) - edgeRank(a, selected.id));
  }, [graph.edges, selected]);

  const relationGroups = useMemo(() => {
    const groups = new Map<EdgeType, RelationGroup>();
    if (!selected) return [];
    for (const edge of selectedEdges) {
      const direction = edge.from === selected.id ? 'out' : 'in';
      const other = nodeMap.get(direction === 'out' ? edge.to : edge.from);
      const group = groups.get(edge.type) || { type: edge.type, edges: [] };
      group.edges.push({ edge, other, direction });
      groups.set(edge.type, group);
    }
    return Array.from(groups.values()).sort((a, b) => b.edges.length - a.edges.length);
  }, [nodeMap, selected, selectedEdges]);

  const focusStats = useMemo(() => buildFocusStats(graph, visible.nodes, visible.edges), [graph, visible.edges, visible.nodes]);
  const graphInsight = useMemo(() => buildGraphInsight(graph, nodeMap), [graph, nodeMap]);

  const focusRelatedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!focusId) return ids;
    ids.add(focusId);
    for (const edge of graph.edges) {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    }
    return ids;
  }, [focusId, graph.edges]);

  function zoom(next: number) {
    setScale(Math.max(.35, Math.min(2.8, Number(next.toFixed(2)))));
  }

  function wheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(scale + (event.deltaY > 0 ? -.08 : .08));
  }

  function addGlobalDragListeners() {
    dragCleanupRef.current?.();
    const handleMove = (event: globalThis.MouseEvent) => moveDragClient(event.clientX, event.clientY);
    const handleUp = () => finishDrag();
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      dragCleanupRef.current = null;
    };
  }

  function startDrag(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button')) return;
    panMovedRef.current = false;
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    addGlobalDragListeners();
  }

  function moveDragClient(clientX: number, clientY: number) {
    const nodeDrag = nodeDragRef.current;
    if (nodeDrag) {
      const nextX = nodeDrag.baseX + (clientX - nodeDrag.startX) / scale;
      const nextY = nodeDrag.baseY + (clientY - nodeDrag.startY) / scale;
      if (Math.abs(clientX - nodeDrag.startX) > 3 || Math.abs(clientY - nodeDrag.startY) > 3) {
        nodeDrag.moved = true;
      }
      setNodePositions(current => ({ ...current, [nodeDrag.id]: { x: nextX, y: nextY } }));
      return;
    }
    const canvasDrag = dragRef.current;
    if (!canvasDrag) return;
    if (Math.abs(clientX - canvasDrag.x) > 3 || Math.abs(clientY - canvasDrag.y) > 3) panMovedRef.current = true;
    setPan({ x: canvasDrag.panX + clientX - canvasDrag.x, y: canvasDrag.panY + clientY - canvasDrag.y });
  }

  function moveDrag(event: MouseEvent<HTMLDivElement>) {
    moveDragClient(event.clientX, event.clientY);
  }

  async function rebuild() {
    setMessage('rebuilding graph');
    const response = await fetch('/api/llm-wiki/rebuild', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ scope: 'all' })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setGraph(result.graph);
      setSelectedId(result.graph.nodes.find((node: LlmWikiGraph['nodes'][number]) => node.type === 'topic')?.id || result.graph.nodes[0]?.id || '');
      setFocusId(null);
      setNodePositions({});
      setMessage(`rebuilt ${result.graph.nodes.length} nodes / ${result.graph.edges.length} edges`);
    } else {
      setMessage(result?.message || 'rebuild failed');
    }
  }

  async function createTaskFromNode(node: GraphNode) {
    setTaskMessage('creating task draft');
    const sourceSlug = node.id.includes(':') ? node.id.split(':').slice(1).join(':') : node.id;
    const sourceType = node.type === 'knowledge' || node.type === 'idea' || node.type === 'project' ? node.type : 'manual';
    const title = node.type === 'task' ? `Follow up: ${node.title}` : `Turn into task: ${node.title}`;
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        sourceType,
        sourceSlug,
        title,
        summary: node.summary ? `Generated from LLM Wiki ${node.type} node. ${node.summary}` : `Generated from LLM Wiki ${node.type} node: ${node.title}.`,
        priority: node.score && node.score >= 80 ? 'P0' : 'P1',
        status: 'next'
      })
    });
    const result = await response.json().catch(() => null);
    setTaskMessage(response.ok && result?.ok ? `task draft created: ${result.task.title}` : result?.message || 'task draft failed');
  }

  function resetView() {
    setScale(.78);
    setPan({ x: 0, y: 0 });
    setFocusId(null);
    setNodePositions({});
  }

  function nodePoint(node: LlmWikiGraph['nodes'][number]) {
    return nodePositions[node.id] || { x: node.x || 0, y: node.y || 0 };
  }

  function startNodeDrag(event: MouseEvent<HTMLButtonElement>, node: LlmWikiGraph['nodes'][number]) {
    event.preventDefault();
    event.stopPropagation();
    const point = nodePoint(node);
    nodeDragRef.current = { id: node.id, startX: event.clientX, startY: event.clientY, baseX: point.x, baseY: point.y, moved: false };
    addGlobalDragListeners();
  }

  function finishDrag() {
    dragCleanupRef.current?.();
    dragRef.current = null;
    window.setTimeout(() => {
      nodeDragRef.current = null;
    }, 0);
  }

  function selectNode(node: LlmWikiGraph['nodes'][number]) {
    if (nodeDragRef.current?.moved) return;
    setSelectedId(node.id);
    setFocusId(node.id);
  }

  function renderCanvas(isFull = false) {
    return <div onClick={event => { if (!panMovedRef.current && !(event.target as HTMLElement).closest('button')) setFocusId(null); }} onWheel={wheel} onMouseDown={startDrag} onMouseMove={moveDrag} onMouseUp={finishDrag} onMouseLeave={finishDrag} className={`${isFull ? 'h-[82vh]' : 'h-[560px]'} relative cursor-grab overflow-hidden rounded-[8px] border border-[var(--border-visible)] bg-[#f6f6f0] active:cursor-grabbing`}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[#f6f6f0]/92 px-4 py-3 backdrop-blur">
        <div className="caption">{focusId ? 'node focus active' : lensLabels[lens]} / {visible.nodes.length} visible nodes / {visible.edges.length} visible edges</div>
        <div className="mono flex gap-2 text-[10px] uppercase">
          <button type="button" onClick={() => zoom(scale - .15)} className="rounded-full border border-[var(--border-visible)] bg-white px-3 py-1">-</button>
          <button type="button" onClick={resetView} className="rounded-full border border-[var(--border-visible)] bg-white px-3 py-1">reset</button>
          <button type="button" onClick={() => zoom(scale + .15)} className="rounded-full border border-[var(--border-visible)] bg-white px-3 py-1">+</button>
          {focusId && <button type="button" onClick={() => setFocusId(null)} className="rounded-full border border-[var(--border-visible)] bg-white px-3 py-1">clear</button>}
        </div>
      </div>
      <div className="absolute left-0 top-0 h-[2600px] w-[3200px] origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y + 58}px) scale(${scale})` }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {visible.edges.map(edge => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const fromPoint = nodePoint(from);
            const toPoint = nodePoint(to);
            const x1 = fromPoint.x + 88;
            const y1 = fromPoint.y + 30;
            const x2 = toPoint.x + 88;
            const y2 = toPoint.y + 30;
            const midX = (x1 + x2) / 2;
            const active = focusId ? edge.from === focusId || edge.to === focusId : edge.from === selected?.id || edge.to === selected?.id;
            const muted = Boolean(focusId && !active);
            return <path key={`${edge.from}-${edge.to}-${edge.type}`} d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} fill="none" stroke={edge.confidence === 'high' ? 'rgba(255,90,31,.72)' : active ? 'rgba(10,10,9,.45)' : 'rgba(10,10,9,.16)'} strokeWidth={edge.confidence === 'high' || active ? 2 : 1} opacity={muted ? .08 : 1} />;
          })}
        </svg>
        {visible.nodes.map(node => <GraphNodeButton key={node.id} node={node} point={nodePoint(node)} active={node.id === selected?.id} focused={node.id === focusId} related={!focusId || focusRelatedIds.has(node.id)} onMouseDown={event => startNodeDrag(event, node)} onClick={() => selectNode(node)} />)}
      </div>
    </div>;
  }

  return <div className="grid gap-5">
    <Panel dark className="console-screen relative overflow-hidden p-6 md:p-8">
      <div className="scanline" />
      <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Label>LLM Wiki / Global Brain Graph</Label>
          <h2 className="mt-5 text-5xl font-semibold leading-none text-white md:text-8xl">LLM Wiki</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div><div className="doto text-6xl text-white">{graph.nodes.length}</div><div className="caption text-white/45">nodes</div></div>
          <div><div className="doto text-6xl text-white">{graph.edges.length}</div><div className="caption text-white/45">edges</div></div>
          <div><div className="doto text-6xl text-white">{visible.nodes.length}</div><div className="caption text-white/45">visible</div></div>
        </div>
      </div>
    </Panel>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Graph Surface" value={graph.generatedAt.slice(0, 10)} />
        <div className="mb-4 rounded-[8px] border border-[var(--border)] bg-white/55 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {focusStats.map(item => <div key={item.label} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="doto text-2xl text-[var(--ink)]">{item.value}</div>
              <div className="caption text-[var(--text-disabled)]">{item.label}</div>
            </div>)}
          </div>
        </div>
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
          <select value={lens} onChange={event => setLens(event.target.value as Lens)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/65 px-4 text-sm outline-none">{Object.entries(lensLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={nodeType} onChange={event => setNodeType(event.target.value as NodeType | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/65 px-4 text-sm outline-none">{Object.entries(nodeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={edgeType} onChange={event => setEdgeType(event.target.value as EdgeType | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/65 px-4 text-sm outline-none">{Object.entries(edgeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={confidence} onChange={event => setConfidence(event.target.value as LlmWikiGraph['edges'][number]['confidence'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/65 px-4 text-sm outline-none">{Object.entries(confidenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input value={query} onChange={event => setQuery(event.target.value)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="Search node title, summary, platform, status..." />
          <button type="button" onClick={() => setFull(true)} className="mono min-h-10 rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase hover:border-[var(--ink)]">fullscreen</button>
        </div>
        {renderCanvas()}
      </Panel>

      <div className="grid content-start gap-5">
        {selected && <Panel raised className="p-5 md:p-6">
          <SectionHeader label="Selected Node" value={selected.type} />
          <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{selected.title}</h3>
          {selected.summary && <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{selected.summary}</p>}
          <div className="mono mt-4 flex flex-wrap gap-2 text-[10px] uppercase text-[var(--text-disabled)]"><span>/{selected.id}</span>{selected.status && <span>{selected.status}</span>}{selected.platform && <span>{selected.platform}</span>}</div>
          <AuthOnly>
            <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
              <button type="button" onClick={() => createTaskFromNode(selected)} className="primary-action mono inline-flex min-h-9 items-center rounded-full px-4 text-[10px] uppercase">create task draft</button>
              <div className="caption mt-2">{taskMessage}</div>
            </div>
          </AuthOnly>
          <div className="mt-5 rounded-[8px] border border-[var(--border)] bg-white/55 p-3">
            <div className="caption text-[var(--text-disabled)]">Why related</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3"><div className="doto text-2xl text-[var(--ink)]">{selectedEdges.length}</div><div className="caption">relations</div></div>
              <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3"><div className="doto text-2xl text-[var(--ink)]">{relationGroups.length}</div><div className="caption">types</div></div>
            </div>
          </div>
          <div className="mt-5 grid gap-2">
            {relationGroups.map(group => <div key={group.type} className="rounded-[8px] border border-[var(--border)] bg-white/45 p-3">
              <div className="caption mb-2 text-[var(--text-disabled)]">{edgeLabels[group.type]} / {group.edges.length}</div>
              <div className="grid gap-2">
                {group.edges.slice(0, 5).map(({ edge, other, direction }) => <button key={`${edge.from}-${edge.to}-${edge.type}`} type="button" onClick={() => { if (other) { setSelectedId(other.id); setFocusId(other.id); } }} className="border-b border-[var(--border)] pb-2 text-left last:border-b-0">
                  <div className="caption">{direction === 'out' ? 'points to' : 'points from'} / {edge.confidence}</div>
                  <p className="text-xs font-medium leading-5 text-[var(--ink)]">{other?.title || 'Unknown node'}</p>
                  <p className="text-xs leading-5 text-[var(--text-secondary)]">{edge.reason}</p>
                </button>)}
              </div>
            </div>)}
          </div>
        </Panel>}

        <Panel className="p-5 md:p-6">
          <SectionHeader label="Graph Insight" value="reasoning" />
          <div className="grid gap-4">
            <InsightBlock title="Strongest relation" empty="No relation detected yet.">
              {graphInsight.strongest && <button type="button" onClick={() => { setSelectedId(graphInsight.strongest!.from.id); setFocusId(graphInsight.strongest!.from.id); }} className="text-left">
                <div className="text-sm font-semibold leading-5 text-[var(--ink)]">{graphInsight.strongest.from.title} {'->'} {graphInsight.strongest.to.title}</div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{edgeLabels[graphInsight.strongest.edge.type]} / {graphInsight.strongest.edge.confidence}: {graphInsight.strongest.edge.reason}</p>
              </button>}
            </InsightBlock>
            <InsightBlock title="Weak spots" empty="No isolated nodes or low-confidence edges in this graph.">
              {graphInsight.weakSpots.length ? graphInsight.weakSpots.map(item => <button key={item.id} type="button" onClick={() => { setSelectedId(item.nodeId); setFocusId(item.nodeId); }} className="border-b border-[var(--border)] pb-2 text-left last:border-b-0">
                <div className="caption">{item.kind}</div>
                <p className="text-xs leading-5 text-[var(--text-secondary)]">{item.text}</p>
              </button>) : null}
            </InsightBlock>
            <InsightBlock title="Next step" empty="No next step suggested yet.">
              {graphInsight.nextSteps.length ? graphInsight.nextSteps.map(step => <p key={step} className="border-b border-[var(--border)] pb-2 text-xs leading-5 text-[var(--text-secondary)] last:border-b-0">{step}</p>) : null}
            </InsightBlock>
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <SectionHeader label="AI Analysis" value={graph.scope} />
          <p className="text-sm leading-6 text-[var(--text-secondary)]">{graph.analysis?.summary || 'No graph analysis yet.'}</p>
          <div className="mt-4 grid gap-3">
            {graph.analysis?.clusters.slice(0, 4).map(cluster => <button key={cluster.topic} type="button" className="border-b border-[var(--border)] pb-3 text-left last:border-b-0" onClick={() => { setLens('focus'); setNodeType('topic'); setQuery(cluster.topic); }}>
              <div className="text-sm font-semibold text-[var(--ink)]">{cluster.topic}</div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{cluster.reason}</p>
            </button>)}
          </div>
        </Panel>

        <AuthOnly>
          <Panel className="p-5 md:p-6">
            <SectionHeader label="Graph Control" value="login only" />
            <button type="button" onClick={rebuild} className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">AI rebuild graph</button>
            <div className="caption mt-3">{message}</div>
          </Panel>
        </AuthOnly>

        <Panel className="p-5 md:p-6">
          <SectionHeader label="Routes" value="jump" />
          <div className="grid gap-2">
            <Link href="/knowledge" className="mono rounded-full border border-[var(--border-visible)] px-4 py-3 text-[10px] uppercase">knowledge</Link>
            <Link href="/ideas" className="mono rounded-full border border-[var(--border-visible)] px-4 py-3 text-[10px] uppercase">ideas</Link>
            <Link href="/tasks" className="mono rounded-full border border-[var(--border-visible)] px-4 py-3 text-[10px] uppercase">tasks</Link>
          </div>
        </Panel>
      </div>
    </section>

    {full && <div className="fixed inset-0 z-50 grid bg-black/80 p-4 backdrop-blur-sm">
      <div className="mb-3 flex justify-end"><button type="button" onClick={() => setFull(false)} className="mono rounded-full border border-white/35 px-4 py-2 text-[11px] uppercase text-white">close</button></div>
      <div className="overflow-hidden rounded-[8px] bg-[var(--surface)] p-3">{renderCanvas(true)}</div>
    </div>}
  </div>;
}

function nodeRank(node: LlmWikiGraph['nodes'][number], selectedRelated: Set<string>, lens: Lens) {
  let score = 0;
  if (selectedRelated.has(node.id)) score += 1000;
  if (node.type === 'topic') score += lens === 'focus' ? 120 : 30;
  if (node.type === 'project') score += 90;
  if (node.type === 'idea') score += 70 + (node.score || 0);
  if (node.type === 'task') score += node.status === 'doing' ? 90 : node.status === 'next' ? 70 : 20;
  if (node.type === 'knowledge') score += node.status === 'linked' ? 80 : node.status === 'processed' ? 60 : 20;
  if (node.status === 'building') score += 60;
  if (node.status === 'shipped') score += 25;
  return score;
}

function edgeRank(edge: LlmWikiGraph['edges'][number], selectedId: string) {
  return confidenceRank[edge.confidence] * 10 + (edge.from === selectedId || edge.to === selectedId ? 100 : 0);
}

function buildFocusStats(graph: LlmWikiGraph, nodes: GraphNode[], edges: GraphEdge[]) {
  return [
    { label: 'shown', value: nodes.length },
    { label: 'hidden', value: Math.max(graph.nodes.length - nodes.length, 0) },
    { label: 'signals', value: edges.length }
  ];
}

function buildGraphInsight(graph: LlmWikiGraph, nodeMap: Map<string, GraphNode>) {
  const degree = new Map(graph.nodes.map(node => [node.id, 0]));
  for (const edge of graph.edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }

  const strongestEdge = [...graph.edges].sort((a, b) => {
    const aScore = confidenceRank[a.confidence] * 100 + (nodeMap.get(a.from)?.score || 0) + (nodeMap.get(a.to)?.score || 0);
    const bScore = confidenceRank[b.confidence] * 100 + (nodeMap.get(b.from)?.score || 0) + (nodeMap.get(b.to)?.score || 0);
    return bScore - aScore;
  })[0];
  const strongest = strongestEdge && nodeMap.get(strongestEdge.from) && nodeMap.get(strongestEdge.to)
    ? { edge: strongestEdge, from: nodeMap.get(strongestEdge.from)!, to: nodeMap.get(strongestEdge.to)! }
    : null;

  const isolated = graph.nodes.filter(node => (degree.get(node.id) || 0) === 0).slice(0, 3).map(node => ({
    id: `isolated-${node.id}`,
    nodeId: node.id,
    kind: 'isolated node',
    text: `${node.title} has no direct edge yet. Add evidence or connect it to a topic before relying on it.`
  }));
  const lowConfidence = graph.edges.filter(edge => edge.confidence === 'low').slice(0, 3).map(edge => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    return {
      id: `low-${edge.from}-${edge.to}-${edge.type}`,
      nodeId: from?.id || to?.id || edge.from,
      kind: 'low confidence',
      text: `${from?.title || edge.from} -> ${to?.title || edge.to}: ${edge.reason}`
    };
  });
  const weakSpots = [...isolated, ...lowConfidence].slice(0, 5);
  const nextSteps = [
    ...(graph.analysis?.nextActions || []),
    isolated.length ? `Connect ${isolated[0].text.split(' has ')[0]} to a topic or project.` : '',
    lowConfidence.length ? 'Review low-confidence relationships before promoting them into tasks.' : ''
  ].filter(Boolean).slice(0, 4);

  return { strongest, weakSpots, nextSteps };
}

function InsightBlock({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Boolean(children);
  return <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-3">
    <div className="caption mb-2 text-[var(--text-disabled)]">{title}</div>
    {hasChildren ? children : <p className="text-xs leading-5 text-[var(--text-secondary)]">{empty}</p>}
  </div>;
}

function GraphNodeButton({ node, point, active, focused, related, onMouseDown, onClick }: { node: LlmWikiGraph['nodes'][number]; point: NodePoint; active: boolean; focused: boolean; related: boolean; onMouseDown: (event: MouseEvent<HTMLButtonElement>) => void; onClick: () => void }) {
  const tone = node.type === 'topic'
    ? 'bg-[var(--ink)] text-white'
    : node.type === 'project'
      ? 'bg-white text-[var(--ink)]'
      : node.type === 'idea'
        ? 'bg-[#fffaf4] text-[var(--ink)]'
        : node.type === 'task'
          ? 'bg-[#f5fff8] text-[var(--ink)]'
          : 'bg-[#f7fbff] text-[var(--ink)]';
  const layer = related ? 'z-20 opacity-100 grayscale-0' : 'z-0 opacity-20 grayscale';
  const focusRing = focused ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/45' : active ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/25' : 'border-[var(--border-visible)]';

  return <button type="button" onMouseDown={onMouseDown} onClick={onClick} className={`absolute w-[190px] cursor-grab rounded-[8px] border px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 active:cursor-grabbing ${tone} ${layer} ${focusRing}`} style={{ left: point.x, top: point.y }}>
    <span className={`caption block ${node.type === 'topic' ? 'text-white/55' : ''}`}>{node.type}</span>
    <span className="block truncate text-sm font-semibold leading-5">{node.title}</span>
    <span className={`mono mt-1 block truncate text-[10px] uppercase ${node.type === 'topic' ? 'text-white/45' : 'text-[var(--text-disabled)]'}`}>{node.status || node.platform || node.id}</span>
  </button>;
}
