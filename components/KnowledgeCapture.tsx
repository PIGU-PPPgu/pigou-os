'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ButtonLink } from '@/components/UI';
import type { KnowledgeNote } from '@/lib/data';

type CaptureState = 'idle' | 'saving' | 'saved' | 'error';

export function KnowledgeCapture({ onCaptured }: { onCaptured?: (note: KnowledgeNote) => void }) {
  const router = useRouter();
  const quickFormRef = useRef<HTMLFormElement>(null);
  const detailFormRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<CaptureState>('idle');
  const [message, setMessage] = useState('直接甩链接或文字，系统会先解析成知识笔记。');

  async function quickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('saving');
    setMessage('正在读取链接并解析...');
    const target = event.currentTarget;
    const form = new FormData(target);
    const input = String(form.get('input') || '').trim();
    const response = await fetch('/api/knowledge/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ input })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setState('error');
      setMessage(result?.message || '解析失败，请检查链接是否能访问。');
      return;
    }

    quickFormRef.current?.reset();
    setState('saved');
    setMessage(result.message || `已捕获：${result.note.title}`);
    onCaptured?.(result.note);
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('saving');
    setMessage('正在写入知识脑...');
    const target = event.currentTarget;
    const form = new FormData(target);
    const payload = {
      title: form.get('title'),
      summary: form.get('summary'),
      type: form.get('type'),
      confidence: form.get('confidence'),
      tags: form.get('tags'),
      relatedProjects: form.get('relatedProjects'),
      sourceUrl: form.get('sourceUrl'),
      keyPoints: form.get('keyPoints'),
      next: form.get('next')
    };

    const response = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setState('error');
      setMessage(result?.message || '写入失败，请检查本地 dev server。');
      return;
    }

    detailFormRef.current?.reset();
    setState('saved');
    setMessage(`已捕获：${result.note.title}`);
    onCaptured?.(result.note);
    router.refresh();
  }

  return <div className="grid gap-5">
    <form ref={quickFormRef} onSubmit={quickSubmit} className="grid gap-4">
      <label className="grid gap-2">
        <span className="caption">甩链接 / 甩文本</span>
        <textarea name="input" required rows={5} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--ink)]" placeholder="URL / 文本 / 聊天记录 / 资料摘要" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === 'saving'} className="mono inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-6 text-[12px] uppercase text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{state === 'saving' ? '解析中' : '自动解析并保存'}</button>
        <span className={`caption ${state === 'error' ? 'text-[var(--danger)]' : state === 'saved' ? 'text-[var(--success)]' : ''}`}>{message}</span>
      </div>
    </form>

    <details className="rounded-[8px] border border-[var(--border)] bg-white/35 p-4">
      <summary className="caption cursor-pointer text-[var(--text-primary)]">手动精修字段</summary>
      <form ref={detailFormRef} onSubmit={submit} className="mt-4 grid gap-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2">
        <span className="caption">标题</span>
        <input name="title" required className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="例如：班主任助手的真实使用场景" />
      </label>
      <label className="grid gap-2">
        <span className="caption">类型</span>
        <select name="type" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" defaultValue="insight">
          <option value="insight">洞察</option>
          <option value="source">资料</option>
          <option value="decision">决策</option>
          <option value="pattern">模式</option>
          <option value="question">问题</option>
          <option value="asset">素材</option>
        </select>
      </label>
    </div>

    <label className="grid gap-2">
      <span className="caption">摘要</span>
      <textarea name="summary" required rows={4} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--ink)]" placeholder="这条内容为什么值得进入 Pigou OS？它影响哪个项目、想法或判断？" />
    </label>

    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2">
        <span className="caption">标签</span>
        <input name="tags" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="education, agent, product" />
      </label>
      <label className="grid gap-2">
        <span className="caption">关联项目</span>
        <input name="relatedProjects" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="headteacher-helper, pigou-os" />
      </label>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2">
        <span className="caption">来源链接</span>
        <input name="sourceUrl" type="url" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="https://..." />
      </label>
      <label className="grid gap-2">
        <span className="caption">可信度</span>
        <select name="confidence" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" defaultValue="medium">
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </label>
    </div>

    <label className="grid gap-2">
      <span className="caption">要点</span>
      <textarea name="keyPoints" rows={3} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none focus:border-[var(--ink)]" placeholder="一行一个要点" />
    </label>

    <label className="grid gap-2">
      <span className="caption">下一步</span>
      <input name="next" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="把它变成项目行动、想法验证或决策记录" />
    </label>

    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={state === 'saving'} className="mono inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-6 text-[12px] uppercase text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{state === 'saving' ? '写入中' : '捕获到知识脑'}</button>
      <ButtonLink href="/knowledge">刷新索引</ButtonLink>
      <span className={`caption ${state === 'error' ? 'text-[var(--danger)]' : state === 'saved' ? 'text-[var(--success)]' : ''}`}>{message}</span>
    </div>
      </form>
    </details>
  </div>;
}
