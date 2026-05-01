'use client';

import { FormEvent, useState } from 'react';
import { AuthOnly, LoginRequired } from '@/components/auth/AuthControls';

type AskState = 'idle' | 'asking' | 'done' | 'error';

export function DeepWikiAsk({ slug, files }: { slug: string; files: string[] }) {
  const [state, setState] = useState<AskState>('idle');
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('Ask self-hosted deepwiki-open about this repository.');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get('question') || '').trim();
    const filePath = String(form.get('filePath') || '').trim();
    if (!question) return;

    setState('asking');
    setAnswer('');
    setMessage('DeepWiki 正在索引/检索仓库，这一步第一次会慢一点。');
    const response = await fetch('/api/deepwiki/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug, question, filePath: filePath || undefined })
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setState('error');
      setMessage(result?.message || 'DeepWiki 请求失败。');
      setAnswer(result?.detail || '');
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      setState('error');
      setMessage('DeepWiki 没有返回可读取的响应流。');
      return;
    }

    const decoder = new TextDecoder();
    let output = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      setAnswer(output);
    }
    output += decoder.decode();
    setAnswer(output.trim());
    setState('done');
    setMessage('DeepWiki answer generated.');
  }

  return <AuthOnly fallback={<LoginRequired />}>
    <form onSubmit={submit} className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
      <div className="caption mb-3">Ask deepwiki-open</div>
      <div className="grid gap-3">
        <textarea name="question" required rows={3} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/70 px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--ink)]" placeholder="例如：这个仓库的核心入口和数据流是什么？有哪些风险？" />
        {files.length ? <select name="filePath" className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/70 px-4 text-sm outline-none focus:border-[var(--ink)]" defaultValue="">
          <option value="">整个仓库</option>
          {files.map(file => <option key={file} value={file}>{file}</option>)}
        </select> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={state === 'asking'} className="mono primary-action inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase disabled:cursor-not-allowed disabled:opacity-50">{state === 'asking' ? 'asking' : 'ask repository'}</button>
          <span className={`caption ${state === 'error' ? 'text-[var(--danger)]' : state === 'done' ? 'text-[var(--success)]' : ''}`}>{message}</span>
        </div>
      </div>
      {answer && <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[8px] border border-[var(--border)] bg-[var(--surface-dark)] p-4 text-xs leading-6 text-white/78">{answer}</pre>}
    </form>
  </AuthOnly>;
}
