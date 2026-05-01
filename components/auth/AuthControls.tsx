'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AuthState = {
  ready: boolean;
  loggedIn: boolean;
  user?: { id: string; name: string } | null;
};

async function getSession(): Promise<AuthState> {
  const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
  const result = await response.json().catch(() => null);
  return { ready: true, loggedIn: Boolean(result?.ok), user: result?.user ?? null };
}

export function AuthOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ ready: false, loggedIn: false });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await getSession().catch(() => ({ ready: true, loggedIn: false }));
      if (!cancelled) setAuth(session);
    }
    check();
    window.addEventListener('pigou-auth-change', check);
    return () => {
      cancelled = true;
      window.removeEventListener('pigou-auth-change', check);
    };
  }, []);

  if (!auth.ready) return null;
  return auth.loggedIn ? <>{children}</> : <>{fallback}</>;
}

export function LoginRequired() {
  return <div className="rounded-[8px] border border-[var(--border)] bg-white/45 p-4">
    <div className="caption mb-2">Login required</div>
    <p className="text-sm leading-6 text-[var(--text-secondary)]">只有 Pigou 登录后才能快速投喂、删除内容和改写本地知识脑。访客只能浏览公开面板。</p>
    <Link href="/login" className="mono mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--ink)] px-4 text-[10px] uppercase text-white">login</Link>
  </div>;
}

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setState('checking');
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setError(result?.message || 'Login failed. Check the local password config.');
      setState('bad');
      return;
    }
    setState('ok');
    window.dispatchEvent(new Event('pigou-auth-change'));
    window.location.assign('/knowledge');
  }

  return <form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-2">
      <span className="caption">Pigou password</span>
      <input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" className="min-h-12 rounded-full border border-[var(--border-visible)] bg-white/70 px-5 text-sm outline-none focus:border-[var(--ink)]" placeholder="输入登录密码" />
    </label>
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={state === 'checking' || !password.trim()} className="mono inline-flex min-h-11 items-center rounded-full bg-[var(--ink)] px-6 text-[12px] uppercase text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{state === 'checking' ? 'checking' : 'login'}</button>
      {state === 'bad' && <span className="caption text-[var(--danger)]">{error || '密码不对，或者服务端还没配置登录密码。'}</span>}
      {state === 'ok' && <span className="caption text-[var(--success)]">已登录。</span>}
    </div>
  </form>;
}

export function AuthNav() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ ready: false, loggedIn: false });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await getSession().catch(() => ({ ready: true, loggedIn: false }));
      if (!cancelled) setAuth(session);
    }
    check();
    window.addEventListener('pigou-auth-change', check);
    return () => {
      cancelled = true;
      window.removeEventListener('pigou-auth-change', check);
    };
  }, []);

  async function logout() {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' });
    window.dispatchEvent(new Event('pigou-auth-change'));
    setAuth({ ready: true, loggedIn: false });
    router.refresh();
  }

  if (!auth.ready) return <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] text-[var(--text-disabled)]">...</span>;
  if (!auth.loggedIn) return <Link href="/login" className="bracket-link rounded-full px-1 py-1 hover:text-[var(--ink)]">登录</Link>;

  return <span className="inline-flex items-center gap-2">
    <span className="rounded-full border border-[var(--border-visible)] px-3 py-1 text-[10px] text-[var(--ink)]">Pigou</span>
    <button type="button" onClick={logout} className="bracket-link rounded-full px-1 py-1 hover:text-[var(--ink)]">退出</button>
  </span>;
}

export function DeleteContentButton({ type, slug, onDeleted }: { type: 'knowledge' | 'ideas' | 'log' | 'projects' | 'tasks'; slug: string; onDeleted?: () => void }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function deleteItem() {
    if (!window.confirm('确定删除这一条？')) return;
    setDeleting(true);
    const response = await fetch('/api/content/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type, slug })
    });
    setDeleting(false);
    if (response.ok) {
      onDeleted?.();
      router.refresh();
    }
  }

  return <AuthOnly>
    <button type="button" onClick={deleteItem} disabled={deleting} className="mono rounded-full border border-[var(--danger)] px-3 py-1.5 text-[10px] uppercase text-[var(--danger)] disabled:opacity-50">{deleting ? '删除中' : '删除'}</button>
  </AuthOnly>;
}
