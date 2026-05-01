import Link from 'next/link';
import { Label, Panel, SectionHeader, StatusBadge } from '@/components/UI';
import { getProjects } from '@/lib/data';

const focus = [
  'AI + education product building',
  'classroom workflow tools',
  'teacher productivity systems',
  'personal knowledge and project operating systems'
];

export const dynamic = 'force-dynamic';

export default function AboutPage() {
  const projects = getProjects();
  const shipped = projects.filter(project => ['headteacher-helper', 'edu-analysis'].includes(project.slug));

  return <div className="grid gap-5">
    <section className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <Panel dark className="console-screen relative min-h-[460px] overflow-hidden p-6 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="scanline" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div>
            <Label>About / Pigou Wu</Label>
            <h2 className="mt-8 max-w-[8ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">About me</h2>
          </div>
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="PiGou Workshop" value="微信公众号" />
        <div className="grid gap-5 md:grid-cols-[220px_1fr] lg:grid-cols-1">
          <img src="/about/pigou-workshop-qrcode.jpg" alt="PiGou Workshop 微信公众号二维码" className="mx-auto aspect-square w-full max-w-[260px] rounded-[8px] border border-[var(--border-visible)] bg-white object-contain p-2" />
          <div>
            <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">欢迎关注我的公众号</h3>
            <div className="caption mt-4">微信扫码 / PiGou Workshop</div>
          </div>
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Focus Areas" value="what I keep building" />
        <div className="grid gap-3">
          {focus.map((item, index) => <div key={item} className="grid grid-cols-[38px_1fr] gap-3 border-b border-[var(--border)] pb-3 last:border-b-0">
            <span className="doto text-3xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
            <span className="text-sm font-medium leading-6 text-[var(--ink)]">{item}</span>
          </div>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="In Production" value="已投入正常使用" />
        <div>
          {shipped.map(project => <Link key={project.slug} href={`/projects/${project.slug}`} className="block border-b border-[var(--border)] py-5 transition last:border-b-0 hover:bg-white/45 md:px-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{project.summary}</p>
            <div className="caption mt-3">{project.domain} / progress {project.progress}% / updated {project.updated}</div>
          </Link>)}
        </div>
      </Panel>
    </section>

  </div>;
}
