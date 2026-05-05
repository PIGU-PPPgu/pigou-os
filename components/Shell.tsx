import Link from 'next/link';
import { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AuthNav } from '@/components/auth/AuthControls';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

const privateNav = [
  ['/', 'Today'],
  ['/overview', '总览'],
  ['/inbox', 'Inbox'],
  ['/projects', '项目'],
  ['/knowledge', '知识'],
  ['/ideas', '想法'],
  ['/llm-wiki', 'LLM Wiki'],
  ['/tasks', '行动'],
  ['/updates', '更新'],
  ['/weekly', 'Weekly'],
  ['/work', 'Work'],
  ['/log', '日志'],
  ['/about', 'About']
];

const publicNav = [
  ['/', 'Home'],
  ['/work', 'Work'],
  ['/projects', 'Projects'],
  ['/updates', 'Updates'],
  ['/about', 'About']
];

export async function Shell({ children }: { children: ReactNode }) {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  const nav = isLoggedIn ? privateNav : publicNav;
  const title = isLoggedIn ? 'Pigou OS' : 'Pigou Wu';
  const label = isLoggedIn ? 'Pigou Wu / Private Knowledge Brain' : 'Pigou Wu / AI + Education';

  return <main className="noise hairline-grid min-h-screen">
    <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8 md:py-7">
      <header className="mb-6 flex w-full min-w-0 flex-col gap-4 border-b border-[var(--border-visible)] pb-5 md:mb-8 md:flex-row md:items-end md:justify-between">
        <Link href="/" className="block">
          <div className="label">{label}</div>
          <h1 className="mt-2 text-5xl font-semibold leading-none text-[var(--ink)] sm:text-6xl md:text-8xl">{title}</h1>
        </Link>
        <nav className="mono grid w-full min-w-0 max-w-full grid-cols-2 gap-2 text-[10px] uppercase text-[var(--text-secondary)] sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:text-[11px]">
          {nav.map(([href, label]) => <Link key={href} className="bracket-link rounded-full px-1 py-1 hover:text-[var(--ink)]" href={href}>{label}</Link>)}
          <AuthNav />
        </nav>
      </header>
      {children}
      <footer className="mt-10 flex flex-col gap-2 border-t border-[var(--border)] pt-5 md:flex-row md:items-center md:justify-between">
        {isLoggedIn ? <>
          <span className="caption">Knowledge Brain + Project Cockpit</span>
          <span className="caption">Knowledge Brain + Project Cockpit / 2026</span>
        </> : <>
          <span className="caption">Pigou Wu / AI + Education</span>
          <span className="caption">Projects, writing, and operating systems / 2026</span>
        </>}
      </footer>
    </div>
  </main>;
}
