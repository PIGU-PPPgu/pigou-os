'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { AuthOnly, DeleteContentButton, LoginRequired } from '@/components/auth/AuthControls';
import { Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import type { Project, Task } from '@/lib/data';

const statusLabel: Record<Task['status'] | 'all', string> = {
  all: '全部状态',
  next: 'Next',
  doing: 'Doing',
  waiting: 'Waiting',
  done: 'Done',
  archived: 'Archived'
};

export function TasksWorkbench({ tasks: initialTasks, projects }: { tasks: Task[]; projects: Project[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [status, setStatus] = useState<Task['status'] | 'all'>('all');
  const [sourceType, setSourceType] = useState<Task['sourceType'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'priority' | 'updated' | 'source'>('priority');
  const [selectedSlug, setSelectedSlug] = useState(initialTasks[0]?.slug || '');
  const [message, setMessage] = useState('ready');

  const filtered = useMemo(() => tasks
    .filter(task => status === 'all' || task.status === status)
    .filter(task => sourceType === 'all' || task.sourceType === sourceType)
    .filter(task => {
      const haystack = [task.title, task.summary, task.sourceType, task.sourceSlug, task.projectSlug, task.priority, task.status].filter(Boolean).join('\n').toLowerCase();
      return !query.trim() || haystack.includes(query.toLowerCase());
    })
    .sort((a, b) => {
      if (sort === 'updated') return b.updated.localeCompare(a.updated);
      if (sort === 'source') return a.sourceType.localeCompare(b.sourceType) || b.updated.localeCompare(a.updated);
      return priorityWeight(a.priority) - priorityWeight(b.priority) || b.updated.localeCompare(a.updated);
    }), [query, tasks, status, sourceType, sort]);

  const nextCount = tasks.filter(task => task.status === 'next').length;
  const doingCount = tasks.filter(task => task.status === 'doing').length;
  const selected = tasks.find(task => task.slug === selectedSlug) || filtered[0] || tasks[0];

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get('title'),
      summary: form.get('summary'),
      priority: form.get('priority'),
      sourceType: 'manual',
      sourceSlug: 'manual',
      projectSlug: form.get('projectSlug')
    };
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setTasks(current => [result.task, ...current]);
      setMessage(`created: ${result.task.title}`);
      event.currentTarget.reset();
    } else {
      setMessage(result?.message || 'create failed');
    }
  }

  async function patchTask(task: Task, patch: Partial<Task>) {
    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug: task.slug, ...patch })
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok) {
      setTasks(current => current.map(item => item.slug === task.slug ? result.task : item));
      setSelectedSlug(result.task.slug);
      setMessage(`updated: ${result.task.title}`);
    } else {
      setMessage(result?.message || 'update failed');
    }
  }

  return <div className="grid gap-5">
    <Panel raised className="p-6 md:p-8">
      <Label>Tasks / Action Queue</Label>
      <h2 className="mt-3 text-5xl font-semibold leading-none text-[var(--ink)] md:text-7xl">What happens next?</h2>
    </Panel>

    <section className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Queue Readout" value={`${tasks.length} local task(s)`} />
        <div className="grid grid-cols-2 gap-3">
          <div><span className="caption">Next</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{nextCount}</div></div>
          <div><span className="caption">Doing</span><div className="doto mt-2 text-5xl leading-none text-[var(--ink)]">{doingCount}</div></div>
        </div>
      </Panel>
      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Manual Task" value="login required" />
        <AuthOnly fallback={<LoginRequired />}>
          <form onSubmit={createManual} className="grid gap-3">
            <input name="title" required className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" placeholder="Task title" />
            <textarea name="summary" rows={3} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none" placeholder="Why this matters / expected output" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="priority" defaultValue="P1" className="min-h-11 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option></select>
              <select name="projectSlug" defaultValue="" className="min-h-11 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select>
            </div>
            <div className="flex flex-wrap items-center gap-3"><button type="submit" className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">create task</button><span className="caption">{message}</span></div>
          </form>
        </AuthOnly>
      </Panel>
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <Panel className="p-5 md:p-6">
      <SectionHeader label="Task Index" value={`${filtered.length} visible`} />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <input value={query} onChange={event => setQuery(event.target.value)} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/45 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="Search tasks..." />
        <select value={status} onChange={event => setStatus(event.target.value as Task['status'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm">{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select value={sourceType} onChange={event => setSourceType(event.target.value as Task['sourceType'] | 'all')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="all">全部来源</option><option value="knowledge">Knowledge</option><option value="idea">Idea</option><option value="project">Project</option><option value="manual">Manual</option></select>
        <select value={sort} onChange={event => setSort(event.target.value as 'priority' | 'updated' | 'source')} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="priority">优先级排序</option><option value="updated">最新更新</option><option value="source">来源分组</option></select>
      </div>
      <div className="grid gap-4">
        {filtered.map(task => <section key={task.slug} onClick={() => setSelectedSlug(task.slug)} className={`grid cursor-pointer gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-start ${selected?.slug === task.slug ? 'bg-white/45 md:px-3' : ''}`}>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><span className="mono rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] uppercase">{task.priority}</span><span className="mono rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] uppercase">{task.status}</span><span className="caption">{task.sourceType} / {task.sourceSlug}</span></div>
            <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{task.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{task.summary}</p>
            {task.projectSlug && <Link className="mono mt-3 inline-flex min-h-9 items-center rounded-full border border-[var(--border-visible)] px-3 text-[10px] uppercase hover:border-[var(--ink)]" href={`/projects/${task.projectSlug}`}>open project</Link>}
          </div>
          <AuthOnly>
            <div className="flex flex-wrap justify-start gap-2 md:justify-end">
              {task.status !== 'doing' && <button type="button" onClick={() => patchTask(task, { status: 'doing' })} className="mono rounded-full border border-[var(--border-visible)] px-3 py-2 text-[10px] uppercase">doing</button>}
              {task.status !== 'done' && <button type="button" onClick={() => patchTask(task, { status: 'done' })} className="mono rounded-full border border-[var(--success)] px-3 py-2 text-[10px] uppercase text-[var(--success)]">done</button>}
              {task.status !== 'archived' && <button type="button" onClick={() => patchTask(task, { status: 'archived' })} className="mono rounded-full border border-[var(--border-visible)] px-3 py-2 text-[10px] uppercase">archive</button>}
              <DeleteContentButton type="tasks" slug={task.slug} onDeleted={() => setTasks(current => current.filter(item => item.slug !== task.slug))} />
            </div>
          </AuthOnly>
        </section>)}
        {!filtered.length && <p className="py-8 text-sm leading-6 text-[var(--text-secondary)]">No local tasks.</p>}
      </div>
    </Panel>
    {selected && <TaskDetail task={selected} projects={projects} message={message} onPatch={patch => patchTask(selected, patch)} />}
    </section>
  </div>;
}

function priorityWeight(priority: Task['priority']) {
  return priority === 'P0' ? 0 : priority === 'P1' ? 1 : 2;
}

function TaskDetail({ task, projects, message, onPatch }: { task: Task; projects: Project[]; message: string; onPatch: (patch: Partial<Task>) => void }) {
  return <Panel raised className="p-5 md:p-6">
    <SectionHeader label="Task Detail" value={task.updated} />
    <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{task.title}</h3>
    <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{task.summary}</p>
    <div className="mono mt-4 flex flex-wrap gap-2 text-[10px] uppercase text-[var(--text-disabled)]">
      <span>{task.sourceType} / {task.sourceSlug}</span>
      {task.projectSlug && <span>{task.projectSlug}</span>}
      {task.due && <span>due {task.due}</span>}
    </div>
    <AuthOnly>
      <form onSubmit={event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onPatch({
          title: String(form.get('title') || ''),
          summary: String(form.get('summary') || ''),
          status: String(form.get('status')) as Task['status'],
          priority: String(form.get('priority')) as Task['priority'],
          projectSlug: String(form.get('projectSlug') || ''),
          due: String(form.get('due') || '')
        });
      }} className="mt-5 grid gap-3">
        <input name="title" defaultValue={task.title} className="min-h-10 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none" />
        <textarea name="summary" defaultValue={task.summary} rows={4} className="resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 py-3 text-sm leading-6 outline-none" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="status" defaultValue={task.status} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm">{Object.entries(statusLabel).filter(([key]) => key !== 'all').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select name="priority" defaultValue={task.priority} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option></select>
          <select name="projectSlug" defaultValue={task.projectSlug || ''} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm"><option value="">No project</option>{projects.map(project => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select>
          <input name="due" type="date" defaultValue={task.due || ''} className="min-h-10 rounded-full border border-[var(--border-visible)] bg-white/55 px-4 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="primary-action mono inline-flex min-h-10 items-center rounded-full px-4 text-[10px] uppercase">save task</button>
          <span className="caption">{message}</span>
        </div>
      </form>
    </AuthOnly>
  </Panel>;
}
