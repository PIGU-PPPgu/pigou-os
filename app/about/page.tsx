import Link from 'next/link';
import { Label, Panel, SectionHeader, StatusBadge } from '@/components/UI';
import { getProjects } from '@/lib/data';

const focus = [
  '从班主任日常里长出来的工具，不是为 demo 做的',
  '成绩分析系统从一次月考跑到现在',
  '一个人的全栈：前端、数据、部署、自动化',
  '所有进展都有 commit 和更新日志可查'
];

const profile = [
  { label: '身份', text: 'Pigou Wu。班主任，自己写代码。做的工具都在学校里跑。' },
  { label: '在做', text: '班主任工作流小程序、成绩分析系统，以及这个把项目、代码、更新放在一起的个人站。' },
  { label: '判断', text: '教育软件大多停在“能用”，因为做的人不在现场。我在现场，所以从自己的痛点开始做。' }
];

const resumeBlocks = [
  { title: '现场', text: '班主任身份是底色。留痕、考勤、成绩、家长沟通这些每天要做的重复劳动，是所有工具的起点。' },
  { title: 'shipped', text: '小程序和成绩分析系统都已上线，进度 90% 以上。停留在原型的项目不算交付。' },
  { title: '闭环', text: 'Next.js 前端、内容数据、GitHub Actions、VPS 部署、公开/私有边界，一个人接到底。' },
  { title: '公开', text: '项目状态、更新日志、commit 都在这个站上。说过的话都附得上证据。' }
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
            <h2 className="mt-8 max-w-2xl text-2xl font-semibold leading-[1.2] text-white sm:text-3xl lg:text-[2.5rem]">班主任，自己写代码。做的工具都在学校里跑。</h2>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/62">这个站是我把项目、代码、更新日志和对教育 AI 的判断放在一起的地方。没有“热爱 AI”这种话，所有 claim 都附得上链接。</p>
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

    <section className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Profile" value="plain version" />
        <div className="grid gap-4">
          {profile.map(item => <div key={item.label} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
            <div className="caption">{item.label}</div>
            <p className="mt-2 text-base leading-8 text-[var(--text-primary)]">{item.text}</p>
          </div>)}
        </div>
      </Panel>

      <Panel raised className="p-5 md:p-6">
        <SectionHeader label="Resume Summary" value="what I bring" />
        <div className="grid gap-4 sm:grid-cols-2">
          {resumeBlocks.map(item => <div key={item.title} className="border-b border-[var(--border)] pb-4 sm:border-b-0 sm:border-l sm:pl-4">
            <h3 className="text-xl font-semibold leading-tight text-[var(--ink)]">{item.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{item.text}</p>
          </div>)}
        </div>
      </Panel>
    </section>

    <section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Focus" value="what I keep building" />
        <div className="grid gap-3">
          {focus.map((item, index) => <div key={item} className="grid grid-cols-[38px_1fr] gap-3 border-b border-[var(--border)] pb-3 last:border-b-0">
            <span className="doto text-3xl leading-none text-[var(--text-disabled)]">{index + 1}</span>
            <span className="text-sm font-medium leading-6 text-[var(--ink)]">{item}</span>
          </div>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Proof In Production" value="已投入正常使用" />
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
