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
            <h2 className="hero-title max-w-[9ch] text-5xl font-semibold leading-[.92] text-white sm:max-w-3xl sm:text-6xl md:text-8xl">Build useful tools for teachers.</h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/62">
              I make small, durable AI products for education: classroom workflows, teacher assistants, learning analytics, and the personal systems that keep those projects moving.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLink primary href="/work">View work</ButtonLink>
            <Link href="/about" className="mono inline-flex min-h-11 items-center rounded-full border border-white/35 px-6 text-[12px] uppercase text-white transition hover:bg-white hover:text-black">About Pigou</Link>
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

          <div className="border-t border-[var(--border)] pt-5">
            <div className="caption">Now</div>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              Most of the work starts in real school operations, then becomes reusable software, prompts, dashboards, or product notes.
            </p>
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
        <p className="text-sm leading-7 text-[var(--text-secondary)]">
          I keep a public trail of shipped tools and experiments here, while the day-to-day project system stays quiet in the background.
        </p>
      </div>
    </Panel>
  </div>;
}
