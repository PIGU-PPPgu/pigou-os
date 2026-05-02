'use client';

import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardPaste, Copy, Loader2, RotateCcw, SendHorizonal } from 'lucide-react';
import { AuthOnly, LoginRequired } from '@/components/auth/AuthControls';
import { Label, Panel, Pill, SectionHeader } from '@/components/UI';
import type { InboxMode, InboxTarget } from '@/lib/inbox-classifier';

type InboxStats = {
  knowledge: number;
  ideas: number;
  tasks: number;
  logs: number;
};

type InboxResult = {
  id: string;
  mode: InboxTarget;
  requestedMode: InboxMode;
  reason: string;
  message: string;
  nextSuggestion: string;
  title: string;
};

const modes: { value: InboxMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'idea', label: 'Idea' },
  { value: 'task', label: 'Task' },
  { value: 'log', label: 'Log' }
];

const destination: Record<InboxTarget, { href: string; label: string }> = {
  knowledge: { href: '/knowledge', label: '知识脑' },
  idea: { href: '/ideas', label: 'Idea 雷达' },
  task: { href: '/tasks', label: '任务列表' },
  log: { href: '/log', label: '日志' }
};

export function InboxWorkbench({ stats, baseUrl }: { stats: InboxStats; baseUrl: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<InboxMode>('auto');
  const [state, setState] = useState<'ready' | 'saving' | 'saved' | 'error'>('ready');
  const [message, setMessage] = useState('ready to capture');
  const [draft, setDraft] = useState('');
  const [results, setResults] = useState<InboxResult[]>([]);

  async function pasteFromClipboard() {
    const text = await navigator.clipboard?.readText().catch(() => '');
    if (!text) {
      setState('error');
      setMessage('clipboard unavailable');
      return;
    }
    setDraft(text.trim());
    inputRef.current?.focus();
  }

  function resetCapture() {
    setDraft('');
    setState('ready');
    setMessage('ready to capture');
    formRef.current?.reset();
    inputRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = draft.trim();
    if (!input) return;

    setState('saving');
    setMessage('routing...');
    const response = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        input,
        mode,
        tags: form.get('tags'),
        title: form.get('title')
      })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setState('error');
      setMessage(result?.message || 'capture failed');
      return;
    }

    const title = String(result.item?.title || result.note?.title || result.idea?.title || result.task?.title || result.log?.title || 'Inbox item');
    setResults(current => [{
      id: `${Date.now()}-${title}`,
      mode: result.mode,
      requestedMode: result.requestedMode,
      reason: result.reason,
      message: result.message,
      nextSuggestion: result.nextSuggestion || '下一步可打开落点继续整理。',
      title
    }, ...current].slice(0, 6));
    setState('saved');
    setMessage(result.message || `saved: ${title}`);
    setDraft('');
    formRef.current?.reset();
    inputRef.current?.focus();
    router.refresh();
  }

  return <div className="grid gap-4 md:gap-5">
    <Panel raised className="overflow-hidden p-4 md:p-7">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="min-w-0">
          <Label>Mobile Inbox</Label>
          <h2 className="mt-2 text-4xl font-semibold leading-none text-[var(--ink)] sm:text-5xl md:text-7xl">Quick Capture</h2>
          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            {modes.map(item => <button key={item.value} type="button" onClick={() => setMode(item.value)} aria-pressed={mode === item.value} aria-label={`Route to ${item.label}`}>
              <Pill active={mode === item.value}>{item.label}</Pill>
            </button>)}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-left sm:text-right">
          <StatCell label="notes" value={stats.knowledge} />
          <StatCell label="ideas" value={stats.ideas} />
          <StatCell label="tasks" value={stats.tasks} />
          <StatCell label="logs" value={stats.logs} />
        </div>
      </div>
    </Panel>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="p-4 md:p-6">
        <SectionHeader label="Capture" value={<StatusText state={state} message={message} />} />
        <AuthOnly fallback={<LoginRequired />}>
          <form ref={formRef} onSubmit={submit} className="grid gap-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                name="input"
                required
                autoFocus
                rows={7}
                value={draft}
                onChange={event => {
                  setDraft(event.target.value);
                  if (state !== 'saving') {
                    setState('ready');
                    setMessage('ready to capture');
                  }
                }}
                className="min-h-[42svh] w-full resize-none rounded-[8px] border border-[var(--border-visible)] bg-white/75 px-4 py-4 pr-14 text-base leading-7 outline-none transition focus:border-[var(--ink)] focus:bg-white md:min-h-[300px]"
                placeholder="Paste a link or thought..."
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-visible)] bg-white/85 text-[var(--text-primary)] shadow-sm transition hover:border-[var(--ink)]"
                aria-label="Paste from clipboard"
                title="Paste"
              >
                <ClipboardPaste aria-hidden size={17} />
              </button>
            </div>

            <details className="rounded-[8px] border border-[var(--border)] bg-white/35 p-3 md:p-4">
              <summary className="caption cursor-pointer text-[var(--text-primary)]">Details</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input name="title" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="标题覆盖" />
                <input name="tags" className="min-h-11 rounded-[8px] border border-[var(--border-visible)] bg-white/60 px-4 text-sm outline-none focus:border-[var(--ink)]" placeholder="标签，用逗号分隔" />
              </div>
            </details>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 sm:flex sm:flex-wrap">
              <button type="submit" disabled={state === 'saving' || !draft.trim()} className="primary-action mono inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[12px] uppercase transition disabled:cursor-not-allowed disabled:opacity-50">
                {state === 'saving' ? <Loader2 aria-hidden size={15} className="animate-spin" /> : <SendHorizonal aria-hidden size={15} />}
                {state === 'saving' ? 'saving' : 'send'}
              </button>
              <button type="button" onClick={resetCapture} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-visible)] bg-white/45 transition hover:border-[var(--ink)]" aria-label="Clear capture" title="Clear">
                <RotateCcw aria-hidden size={16} />
              </button>
              <span className="caption col-span-2 min-w-0 sm:ml-1">{draft.trim().length ? `${draft.trim().length} chars / ${mode}` : mode}</span>
            </div>
          </form>
        </AuthOnly>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Routes" value={`${results.length} session item(s)`} />
        <div className="grid gap-4">
          {results.map(result => {
            const target = destination[result.mode];
            return <section key={result.id} className="border-b border-[var(--border)] pb-4 last:border-b-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="mono inline-flex items-center gap-2 text-[10px] uppercase text-[var(--success)]"><CheckCircle2 aria-hidden size={14} />{result.mode}</span>
                <Link href={target.href} className="mono rounded-full border border-[var(--border-visible)] px-3 py-1.5 text-[10px] uppercase hover:border-[var(--ink)]">{target.label}</Link>
              </div>
              <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{result.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{result.message}</p>
              <dl className="mt-3 grid gap-2 text-sm leading-6 text-[var(--text-secondary)]">
                <div>
                  <dt className="caption inline text-[var(--text-muted)]">分类原因 </dt>
                  <dd className="inline">{result.requestedMode === 'auto' ? result.reason : `手动选择 ${result.requestedMode}`}</dd>
                </div>
                <div>
                  <dt className="caption inline text-[var(--text-muted)]">落点 </dt>
                  <dd className="inline">{target.label}</dd>
                </div>
                <div>
                  <dt className="caption inline text-[var(--text-muted)]">下一步 </dt>
                  <dd className="inline">{result.nextSuggestion}</dd>
                </div>
              </dl>
            </section>;
          })}
          {!results.length && <p className="py-8 text-sm leading-6 text-[var(--text-secondary)]">No session routes.</p>}
        </div>
      </Panel>
    </section>

    <MobileIngressPanel baseUrl={baseUrl} />
  </div>;
}

function StatusText({ state, message }: { state: string; message: string }) {
  return <span className={state === 'error' ? 'text-[var(--danger)]' : state === 'saved' ? 'text-[var(--success)]' : ''}>{message}</span>;
}

function StatCell({ value, label }: { value: number; label: string }) {
  return <div className="min-w-0 border-t border-[var(--border)] pt-3">
    <div className="doto truncate text-3xl leading-none text-[var(--ink)] md:text-4xl">{String(value).padStart(2, '0')}</div>
    <div className="caption mt-1">{label}</div>
  </div>;
}

function MobileIngressPanel({ baseUrl }: { baseUrl: string }) {
  const secretHint = 'YOUR_PIGOU_INBOX_WEBHOOK_SECRET';
  const shortcutUrl = `${baseUrl || 'https://pigou-os.intellicode.top'}/api/inbox/shortcut?secret=${secretHint}`;
  const feishuUrl = `${baseUrl || 'https://pigou-os.intellicode.top'}/api/inbox/feishu`;
  const wecomUrl = `${baseUrl || 'https://pigou-os.intellicode.top'}/api/inbox/wecom?secret=${secretHint}`;

  return <Panel className="p-5 md:p-6">
    <SectionHeader label="Mobile Ingress" value="iOS / Feishu / WeCom" />
    <div className="grid gap-4 lg:grid-cols-3">
      <IngressCard
        title="iOS Shortcut"
        meta="share sheet"
        endpoint={shortcutUrl}
        body={`{"input":"Shortcut Input","mode":"auto","tags":"mobile,shortcut"}`}
        steps={['Share Sheet receives URLs/text', 'Get Contents of URL', 'POST JSON to endpoint']}
      />
      <IngressCard
        title="飞书"
        meta="bot / automation"
        endpoint={feishuUrl}
        header={`Authorization: Bearer ${secretHint}`}
        body={`{"input":"{{message.text}}","mode":"auto","tags":"mobile,feishu"}`}
        steps={['自定义机器人或自动化', 'POST JSON', 'Authorization Bearer secret']}
      />
      <IngressCard
        title="企业微信"
        meta="webhook"
        endpoint={wecomUrl}
        body={`{"text":"{{message}}","mode":"auto","tags":"mobile,wecom"}`}
        steps={['回调 URL 带 secret', '文本字段用 text/content/message', '10 秒投喂到 Inbox']}
      />
    </div>
  </Panel>;
}

function IngressCard({ title, meta, endpoint, header, body, steps }: { title: string; meta: string; endpoint: string; header?: string; body: string; steps: string[] }) {
  async function copy(value: string) {
    await navigator.clipboard?.writeText(value).catch(() => undefined);
  }

  return <section className="grid content-start gap-4 rounded-[8px] border border-[var(--border)] bg-white/40 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{title}</h3>
        <div className="caption mt-1">{meta}</div>
      </div>
      <button type="button" onClick={() => copy(endpoint)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-visible)] bg-white/70 transition hover:border-[var(--ink)]" aria-label={`Copy ${title} endpoint`} title="Copy endpoint">
        <Copy aria-hidden size={15} />
      </button>
    </div>
    <div className="grid gap-2">
      <div className="caption">endpoint</div>
      <code className="block break-all rounded-[8px] border border-[var(--border)] bg-white/65 p-3 text-xs leading-5 text-[var(--ink)]">{endpoint}</code>
    </div>
    {header && <div className="grid gap-2">
      <div className="caption">header</div>
      <code className="block break-all rounded-[8px] border border-[var(--border)] bg-white/65 p-3 text-xs leading-5 text-[var(--ink)]">{header}</code>
    </div>}
    <div className="grid gap-2">
      <div className="caption">json body</div>
      <code className="block whitespace-pre-wrap rounded-[8px] border border-[var(--border)] bg-white/65 p-3 text-xs leading-5 text-[var(--ink)]">{body}</code>
    </div>
    <ul className="grid gap-2">
      {steps.map(step => <li key={step} className="text-sm leading-6 text-[var(--text-secondary)]">{step}</li>)}
    </ul>
  </section>;
}
