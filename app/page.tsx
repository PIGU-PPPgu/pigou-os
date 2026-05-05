import Link from 'next/link';
import { cookies } from 'next/headers';
import { ButtonLink, Label, Panel } from '@/components/UI';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { getProjects, type Project } from '@/lib/data';
import TodayPage from './today/page';

export const dynamic = 'force-dynamic';

const publicFocus = [
  'Education AI products',
  'Teacher workflow tools',
  'Classroom data systems'
];

function isProject(project: Project | undefined): project is Project {
  return Boolean(project);
}

export default async function HomePage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  if (isLoggedIn) return <TodayPage />;
  const projects = getProjects();
  const selectedWork = ['headteacher-helper', 'edu-analysis', 'pigou-os']
    .map(slug => projects.find(project => project.slug === slug))
    .filter(isProject);

  return <div className="grid gap-5">
    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Panel dark className="console-screen relative min-h-[520px] overflow-hidden p-6 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="scanline" />
        <div className="relative flex h-full flex-col justify-between gap-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Pigou Wu / Education AI Builder</Label>
            <span className="live-pill mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55">Public Studio</span>
          </div>

          <div>
            <h2 className="hero-title max-w-[9ch] text-5xl font-semibold leading-[.92] text-white sm:max-w-3xl sm:text-6xl md:text-8xl">Pigou Workshop</h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink primary href="/work">View work</ButtonLink>
            <ButtonLink href="/about">About Pigou</ButtonLink>
          </div>
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <div className="flex h-full flex-col justify-between gap-8">
          <div>
            <Label>What I Keep Building</Label>
            <div className="mt-5 grid gap-3">
              {publicFocus.map((item, index) => <div key={item} className="grid grid-cols-[42px_1fr] gap-3 border-b border-[var(--border)] pb-4 last:border-b-0">
                <span className="doto text-4xl leading-none text-[var(--text-disabled)]">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-lg font-semibold leading-tight text-[var(--ink)]">{item}</span>
              </div>)}
            </div>
          </div>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 md:grid-cols-3">
      {selectedWork.map(project => <Link key={project.slug} href={project.slug === 'pigou-os' ? '/work' : `/projects/${project.slug}`} className="surface motion-panel panel-corners block min-h-64 p-5 transition hover:border-[var(--border-visible)] hover:bg-white/55">
        <div className="caption">Selected work</div>
        <h3 className="mt-5 text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
        <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{project.explanation || project.summary}</p>
      </Link>)}
    </section>

    <Panel className="p-5 md:p-6">
      <div className="grid gap-5 md:grid-cols-[.75fr_1.25fr] md:items-end">
        <div>
          <Label>Pigou Workshop</Label>
          <h3 className="mt-3 text-4xl font-semibold leading-none text-[var(--ink)] md:text-6xl">Projects, notes, and experiments.</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right">
          <div><div className="doto text-4xl leading-none text-[var(--ink)]">{selectedWork.length}</div><div className="caption mt-1">selected</div></div>
          <div><div className="doto text-4xl leading-none text-[var(--ink)]">{projects.filter(project => project.status === 'shipped').length}</div><div className="caption mt-1">shipped</div></div>
          <div><div className="doto text-4xl leading-none text-[var(--ink)]">{projects.length}</div><div className="caption mt-1">projects</div></div>
        </div>
      </div>
    </Panel>
  </div>;
}
