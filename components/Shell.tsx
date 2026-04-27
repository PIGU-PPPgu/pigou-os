import Link from 'next/link';
import { ReactNode } from 'react';

const nav = [['/', 'Home'], ['/projects', 'Projects'], ['/ideas', 'Ideas'], ['/tasks', 'Tasks'], ['/log', 'Log']];
export function Shell({ children }: { children: ReactNode }) {
  return <main className="noise mx-auto min-h-screen max-w-7xl px-5 py-6 md:px-8 md:py-10">
    <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <Link href="/" className="block"><div className="label">Pigou Wu / Personal Operating System</div><h1 className="mt-3 text-6xl font-semibold leading-none tracking-[-.09em] text-white md:text-8xl">Pigou OS</h1></Link>
      <nav className="mono flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] uppercase text-[var(--text-disabled)]">
        {nav.map(([href, label], idx) => <span key={href} className="flex items-center gap-3"><Link className="hover:text-white" href={href}>{idx === 0 ? `[ ${label} ]` : label}</Link>{idx < nav.length - 1 && <span className="text-[var(--border-visible)]">/</span>}</span>)}
      </nav>
    </header>
    {children}
  </main>;
}
