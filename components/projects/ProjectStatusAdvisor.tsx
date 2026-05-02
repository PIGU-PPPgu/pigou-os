'use client';

import { useEffect, useState } from 'react';
import { Panel, SectionHeader, StatusBadge } from '@/components/UI';
import type { ProjectStatusSuggestion } from '@/lib/project-status';

export function ProjectStatusAdvisor({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<ProjectStatusSuggestion[]>([]);
  const [message, setMessage] = useState(enabled ? 'loading suggestions' : 'locked');
  const [busySlug, setBusySlug] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/projects/status-suggestions')
      .then(response => response.json())
      .then(result => {
        if (cancelled) return;
        setItems(result.suggestions || []);
        setMessage(result.ok ? `${result.suggestions?.length || 0} suggestion(s)` : result.message || 'failed');
      })
      .catch(error => !cancelled && setMessage(error.message));
    return () => { cancelled = true; };
  }, [enabled]);

  async function review(item: ProjectStatusSuggestion, action: 'apply' | 'ignore') {
    setBusySlug(item.slug);
    setMessage(`${action === 'apply' ? 'applying' : 'ignoring'} ${item.title}`);
    try {
      const response = await fetch('/api/projects/status-suggestions', {
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
    <SectionHeader label="AI Progress Engine" value={message} />
    {enabled && !items.length && <div className="caption">no pending diff</div>}
    {enabled && items.length > 0 && <div className="grid gap-3">
      {items.slice(0, 8).map(item => <div key={item.slug} className="rounded-[8px] border border-[var(--border)] bg-white/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">{item.title}</div>
            <div className="caption mt-1">{item.evaluation.source} / {item.evaluation.model} / confidence {item.confidence}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div><div className="caption mb-1">current</div><StatusBadge status={item.currentStatus} /></div>
            <div><div className="caption mb-1">suggested</div><StatusBadge status={item.suggestedStatus} /></div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-[var(--text-secondary)] md:grid-cols-[160px_1fr_132px] md:items-start">
          <div className="grid gap-3">
            <div>
              <span className="caption">suggested progress</span>
              <div className="doto mt-1 text-4xl leading-none text-[var(--ink)]">{item.currentProgress}{' to '}{item.suggestedProgress}</div>
            </div>
            <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-3">
              <div className="caption">confidence</div>
              <div className="mono mt-2 text-xs uppercase text-[var(--ink)]">{item.confidence}</div>
            </div>
          </div>
          <div>
            <p className="mb-3 text-[var(--text-primary)]">{item.evaluation.summary}</p>
            <div className="caption mb-1">AI rationale</div>
            <p>{item.rationale}</p>
            <div className="caption mb-1 mt-3">evidence</div>
            <ul className="grid gap-1">
              {(item.evaluation.evidence.length ? item.evaluation.evidence : item.signals).slice(0, 4).map(signal => <li key={signal}>{signal}</li>)}
            </ul>
            <div className="caption mb-1 mt-3">suggested next actions</div>
            <ul className="grid gap-1">
              {item.suggestedNextActions.map(action => <li key={action}>{action}</li>)}
            </ul>
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
