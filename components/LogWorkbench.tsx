'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { AuthOnly, DeleteContentButton, LoginRequired } from '@/components/auth/AuthControls';
import { Label, Panel, SectionHeader } from '@/components/UI';
import type { Log, Project, Task } from '@/lib/data';

export function LogWorkbench({ logs: initialLogs, projects, tasks }: { logs: Log[]; projects: Project[]; tasks: Task[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [logs, setLogs] = useState(initialLogs);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [message, setMessage] = useState('ready');
  const tags = useMemo(() => Array.from(new Set(logs.flatMap(log => log.tags))).sort(), [logs]);
  const filtered = useMemo(() => logs.filter(log => {
    const haystack = [log.title, log.content, ...log.tags].join('\n').toLowerCase();
    return (tag === 'all' || log.tags.includes(tag)) && (!query.trim() || haystack.includes(query.toLowerCase()));
  }), [logs, query, tag]);
  const todayTasks = tasks.filter(task => task.status === 'done' || task.status === 'doing').slice(0, 5);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('writing log');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        title: form.get('title'),
        date: form.get('date'),
        tags: form.get('tags'),
        content: form.get('content')
      })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setLogs(current => [result.log, ...current]);
      setMessage(`saved: ${result.log.title}`);
      formRef.current?.reset();
    } else {
      setMessage(result?.message || 'save failed');
    }
  }

  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <Label>Log / Review System</Label>
      <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">What changed?</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">Log is the review layer: decisions, daily notes, project retrospectives, and why a task moved.</p>
    </Panel>

    <section className="grid gap-5 lg:grid-cols-[.88fr_1.12fr]">
      <div className="grid content-start gap-5">
        <Panel className="p-5 md:p-6">
          <SectionHeader label="New Log" value="login required" />
          <AuthOnly fallback={<LoginRequired />}>
            <form ref={formRef} onSubmit={submit} className="grid gap-3">
              <input name="title" required className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" placeholder="Decision, review, or daily note title" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="date" type="date" className="min-h-11 rounded-full border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" />
                <input name="tags" className="min-h-11 rounded-full border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" placeholder="daily, decision, project-slug" />
              </div>
              <textarea name="content" required rows={6} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none" placeholder="事实 / 判断 / 阻塞 / 下一步。写得短也可以，关键是留下决策理由。" />
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">save log</button>
                <span className="caption">{message}</span>
              </div>
            </form>
          </AuthOnly>
        </Panel>

        <Panel className="p-5 md:p-6">
          <SectionHeader label="Review Prompts" value="operating loop" />
          <div className="grid gap-3 text-sm leading-7 text-[var(--text-secondary)]">
            <p><span className="caption mr-2">Fact</span>What actually changed?</p>
            <p><span className="caption mr-2">Decision</span>What did this make you believe?</p>
            <p><span className="caption mr-2">Blocker</span>What is stuck and why?</p>
            <p><span className="caption mr-2">Action</span>What should happen next?</p>
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <SectionHeader label="Context" value={`${projects.length} projects / ${tasks.length} tasks`} />
          <div className="grid gap-2">
            {todayTasks.map(task => <div key={task.slug} className="border-b border-[var(--border)] pb-2 text-sm leading-6 last:border-b-0">
              <span className="caption mr-2">{task.status}</span>{task.title}
            </div>)}
          </div>
        </Panel>
      </div>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Log Index" value={`${filtered.length} visible / ${logs.length} total`} />
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <input value={query} onChange={event => setQuery(event.target.value)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="Search log title, content, tags..." />
          <select value={tag} onChange={event => setTag(event.target.value)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm">
            <option value="all">All tags</option>
            {tags.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="grid gap-5">
          {filtered.map(log => <section key={log.slug} className="border-b border-[var(--border)] pb-5 last:border-b-0">
            <SectionHeader label={log.date} value={<span className="inline-flex flex-wrap items-center justify-end gap-2">{log.tags.join(' / ')}<DeleteContentButton type="log" slug={log.slug} onDeleted={() => setLogs(current => current.filter(item => item.slug !== log.slug))} /></span>} />
            <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)] md:text-5xl">{log.title}</h3>
            <p className="mt-4 max-w-4xl text-base leading-8 text-[var(--text-secondary)]">{log.content}</p>
          </section>)}
          {!filtered.length && <p className="py-8 text-sm leading-6 text-[var(--text-secondary)]">No logs match this filter.</p>}
        </div>
      </Panel>
    </section>
  </div>;
}
