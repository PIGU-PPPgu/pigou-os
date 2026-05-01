'use client';

import { useState } from 'react';

export type TodayLogDraft = {
  title: string;
  date: string;
  tags: string[];
  content: string;
};

export function TodayLogButton({ draft }: { draft: TodayLogDraft }) {
  const [state, setState] = useState<'idle' | 'writing' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('log draft armed');

  async function createLog() {
    setState('writing');
    setMessage('writing daily log');
    const response = await fetch('/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: draft.title,
        date: draft.date,
        tags: draft.tags,
        content: draft.content
      })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setState('saved');
      setMessage(`saved: ${result.log.title}`);
    } else {
      setState('error');
      setMessage(result?.message || 'save failed');
    }
  }

  return <div className="grid gap-3 border-t border-white/15 pt-4">
    <button
      type="button"
      onClick={createLog}
      disabled={state === 'writing' || state === 'saved'}
      className="mono inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/35 bg-white px-5 text-[11px] uppercase text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
    >
      {state === 'writing' ? 'generating log' : state === 'saved' ? 'log generated' : 'generate today log'}
    </button>
    <span className={`caption ${state === 'error' ? 'text-[var(--danger)]' : 'text-white/48'}`}>{message}</span>
  </div>;
}
