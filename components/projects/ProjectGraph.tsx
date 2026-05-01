'use client';

import { PointerEvent, WheelEvent, useMemo, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';

type Edge = { from: string; to: string; label: string };
type Node = { id: string; label: string; x: number; y: number; side: 'left' | 'right' };

function shortLabel(label: string, max = 34) {
  return label.length > max ? `${label.slice(0, max - 1)}...` : label;
}

function buildNodes(edges: Edge[]) {
  const left = Array.from(new Set(edges.map(edge => edge.from))).slice(0, 10);
  const right = Array.from(new Set(edges.map(edge => edge.to))).slice(0, 10);
  const leftStep = Math.max(62, 430 / Math.max(1, left.length));
  const rightStep = Math.max(62, 430 / Math.max(1, right.length));
  const nodes: Node[] = [
    ...left.map((label, index) => ({ id: `from:${label}`, label, x: 150, y: 70 + index * leftStep, side: 'left' as const })),
    ...right.map((label, index) => ({ id: `to:${label}`, label, x: 770, y: 70 + index * rightStep, side: 'right' as const }))
  ];
  return nodes;
}

function iconButtonClass() {
  return 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/8 text-white/72 transition hover:border-white/45 hover:text-white';
}

export function ProjectGraph({ edges }: { edges: Edge[] }) {
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const visibleEdges = edges.slice(0, 14);
  const nodes = useMemo(() => buildNodes(visibleEdges), [visibleEdges]);
  const nodeBySideLabel = useMemo(() => new Map(nodes.map(node => [`${node.side === 'left' ? 'from' : 'to'}:${node.label}`, node])), [nodes]);

  function reset() {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  function zoom(delta: number) {
    setScale(current => Math.max(0.55, Math.min(2.1, Number((current + delta).toFixed(2)))));
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoom(event.deltaY > 0 ? -0.08 : 0.08);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.startX + event.clientX - drag.x,
      y: drag.startY + event.clientY - drag.y
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag?.pointerId === event.pointerId) setDrag(null);
  }

  const graph = <div className="grid h-full min-h-0 gap-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="caption text-white/45">结构图谱</div>
        <div className="mono mt-1 text-[10px] uppercase text-white/28">drag canvas / zoom / click expand</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" title="缩小" onClick={() => zoom(-0.12)} className={iconButtonClass()}><Minus size={14} /></button>
        <button type="button" title="放大" onClick={() => zoom(0.12)} className={iconButtonClass()}><Plus size={14} /></button>
        <button type="button" title="重置" onClick={reset} className={iconButtonClass()}><RotateCcw size={14} /></button>
        <button type="button" title={expanded ? '关闭' : '点击放大'} onClick={() => setExpanded(current => !current)} className={iconButtonClass()}>{expanded ? <X size={14} /> : <Maximize2 size={14} />}</button>
      </div>
    </div>

    <div
      role="presentation"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative min-h-0 flex-1 cursor-grab overflow-hidden rounded-[8px] border border-white/15 bg-[var(--surface-dark)] active:cursor-grabbing ${expanded ? 'h-[min(76vh,760px)]' : 'h-[360px]'}`}
    >
      <svg className="h-full w-full select-none" viewBox="0 0 980 560" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
          {visibleEdges.map((edge, index) => {
            const from = nodeBySideLabel.get(`from:${edge.from}`);
            const to = nodeBySideLabel.get(`to:${edge.to}`);
            if (!from || !to) return null;
            const yMid = (from.y + to.y) / 2;
            return <g key={`${edge.from}-${edge.to}-${index}`}>
              <path d={`M ${from.x + 176} ${from.y} C 390 ${from.y}, 520 ${yMid}, ${to.x - 176} ${to.y}`} fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="1.4" />
              <text x="490" y={yMid - 7} textAnchor="middle" className="mono" fontSize="10" fill="rgba(255,255,255,.48)">{shortLabel(edge.label, 16).toUpperCase()}</text>
            </g>;
          })}

          {nodes.map(node => <g key={node.id}>
            <rect x={node.x - 176} y={node.y - 24} width="352" height="48" rx="24" fill={node.side === 'left' ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.14)'} stroke="rgba(255,255,255,.36)" />
            <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="14" fill="rgba(255,255,255,.9)" fontFamily="Space Grotesk, sans-serif">{shortLabel(node.label)}</text>
          </g>)}
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/15 bg-black/35 px-3 py-1">
        <span className="mono text-[10px] uppercase text-white/50">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  </div>;

  return <>
    <div className="relative min-h-[430px] overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-white">{graph}</div>
    {expanded && <div className="fixed inset-0 z-50 bg-black/72 p-4 backdrop-blur-sm md:p-8">
      <div className="mx-auto h-full max-w-7xl rounded-[8px] border border-white/20 bg-[var(--surface-dark)] p-4 text-white shadow-2xl">
        {graph}
      </div>
    </div>}
  </>;
}
