import Link from 'next/link';
import { ImageGallery } from '@/components/ImageGallery';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import { getProjects } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default function WorkPage() {
  const projects = getProjects()
    .filter(project => project.status === 'shipped' || project.images?.some(image => image.public) || project.visibility !== 'private')
    .sort((a, b) => Number(b.status === 'shipped') - Number(a.status === 'shipped') || b.progress - a.progress);
  const featured = projects.filter(project => project.status === 'shipped').slice(0, 3);

  return <div className="grid gap-5">
    <Panel dark className="console-screen relative min-h-[380px] overflow-hidden p-6 md:p-8">
      <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
      <div className="scanline" />
      <div className="relative flex h-full flex-col justify-between gap-10">
        <div>
          <Label>作品集 / Pigou Workshop</Label>
          <h2 className="mt-8 max-w-[10ch] text-5xl font-semibold leading-[.92] text-white md:text-8xl">做过的一些东西</h2>
        </div>
      </div>
    </Panel>

    <section className="grid gap-5 lg:grid-cols-3">
      {featured.map(project => <Panel key={project.slug} raised className="overflow-hidden p-0">
        {project.images?.find(image => image.public) && <img src={project.images.find(image => image.public)?.src} alt={project.title} className="h-56 w-full object-contain bg-[var(--surface-soft)] p-3" />}
        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-2"><StatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
          <h3 className="text-2xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{project.explanation || project.summary}</p>
          <Link href={`/projects/${project.slug}`} className="mono mt-4 inline-flex min-h-10 items-center rounded-full border border-[var(--border-visible)] px-4 text-[10px] uppercase text-[var(--text-primary)]">查看项目</Link>
        </div>
      </Panel>)}
    </section>

    <Panel className="p-5 md:p-6">
      <SectionHeader label="公开项目" value={`${projects.length} 个项目`} />
      <div className="grid gap-5">
        {projects.map(project => {
          const publicImages = project.images?.filter(image => image.public).slice(0, 2) || [];
          return <div key={project.slug} className={`grid gap-5 border-b border-[var(--border)] pb-5 last:border-b-0 ${publicImages.length ? 'lg:grid-cols-[.8fr_1.2fr]' : ''}`}>
            <div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} />{project.visibility === 'private' && <span className="mono inline-flex min-h-7 items-center rounded-full border border-[var(--ink)] px-3 text-[10px] uppercase text-[var(--ink)]">公开简介</span>}</div>
              <h3 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{project.explanation || project.summary}</p>
              <div className="mt-4"><ButtonLink href={`/projects/${project.slug}`}>查看项目</ButtonLink></div>
            </div>
            {publicImages.length ? <ImageGallery images={publicImages} /> : null}
          </div>;
        })}
      </div>
    </Panel>
  </div>;
}
