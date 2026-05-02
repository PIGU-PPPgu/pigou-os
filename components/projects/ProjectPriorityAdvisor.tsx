'use client';

import { useEffect, useState } from 'react';
import { Panel, PriorityBadge, SectionHeader } from '@/components/UI';
import type { ProjectPriorityAdvice } from '@/lib/project-priority';

export function ProjectPriorityAdvisor({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<ProjectPriorityAdvice[]>([]);
  const [message, setMessage] = useState(enabled ? 'loading suggestions' : 'locked');
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/projects/priority-suggestions')
      .then(response => response.json())
      .then(result => {
        if (cancelled) return;
        setItems(result.suggestions || []);
        setMessage(result.ok ? `${result.suggestions?.length || 0} suggestion(s)` : result.message || 'failed');
      })
      .catch(error => !cancelled && setMessage(error.message));
    return () => { cancelled = true; };
  }, [enabled]);

  async function review(item: ProjectPriorityAdvice, action: 'apply' | 'ignore') {
    setBusySlug(item.slug);
    setMessage(`${action === 'apply' ? 'applying' : 'ignoring'} ${item.title}`);
    try {
      const response = await fetch('/api/projects/priority-suggestions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: item.slug, action, suggestion: item })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        setMessage(result?.message || `${action} failed`);
        return;
      }
      setItems(current => current.filter(entry => entry.slug !== item.slug));
      setMessage(action === 'apply' ? `updated ${item.title}` : `ignored ${item.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} failed`);
    } finally {
      setBusySlug(null);
    }
  }

  return <Panel className="p-5 md:p-6">
    <SectionHeader label="AI Priority Engine" value={message} />
    {enabled && !items.length && <div className="caption">no pending priority diff</div>}
    {enabled && items.length > 0 && <div className="grid gap-3">
      {items.slice(0, 8).map(item => <div key={item.slug} className="rounded-[8px] border border-[var(--border)] bg-white/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">{item.title}</div>
            <div className="caption mt-1">{item.suggestion.source} / {item.suggestion.model} / score {item.score} / confidence {item.confidence}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div><div className="caption mb-1">current</div><PriorityBadge priority={item.currentPriority} /></div>
            <div><div className="caption mb-1">suggested</div><PriorityBadge priority={item.suggestedPriority} /></div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--text-secondary)] md:grid-cols-[160px_1fr_132px] md:items-start">
          <div className="grid gap-3">
            <div>
              <span className="caption">priority score</span>
              <div className="doto mt-1 text-5xl leading-none text-[var(--ink)]">{item.score}</div>
            </div>
            <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-3">
              <div className="caption">confidence</div>
              <div className="mono mt-2 text-xs uppercase text-[var(--ink)]">{item.confidence}</div>
            </div>
          </div>
          <div>
            <p className="mb-3 text-[var(--text-primary)]">{item.rationale}</p>
            <div className="caption mb-1">evidence</div>
            <ul className="grid gap-1">
              {item.evidence.slice(0, 5).map(signal => <li key={signal}>{signal}</li>)}
            </ul>
            <div className="caption mb-1 mt-3">dimensions</div>
            <div className="grid gap-2">
              {item.suggestion.dimensions.map(dimension => <div key={dimension.name}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="caption">{dimension.name}</span>
                  <span className="caption text-[var(--text-primary)]">{dimension.score}/{dimension.max}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]"><div className="meter-fill h-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, (dimension.score / dimension.max) * 100))}%` }} /></div>
              </div>)}
            </div>
          </div>
          <div className="grid gap-2">
            <button type="button" disabled={busySlug === item.slug} onClick={() => review(item, 'apply')} className="primary-action mono inline-flex min-h-10 items-center justify-center rounded-full px-4 text-[10px] uppercase disabled:opacity-55">apply</button>
            <button type="button" disabled={busySlug === item.slug} onClick={() => review(item, 'ignore')} className="mono inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-[10px] uppercase text-[var(--text-secondary)] transition hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:opacity-55">ignore</button>
          </div>
        </div>
      </div>)}
    </div>}
  </Panel>;
}
