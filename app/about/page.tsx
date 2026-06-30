import Link from 'next/link';
import { Label, Panel, SectionHeader, StatusBadge } from '@/components/UI';
import { getProjects } from '@/lib/data';

const focus = [
  '把教师和班主任的真实流程拆成可使用的软件工具',
  '用 AI 做教育数据分析、工作流辅助和结构化记录',
  '独立完成从产品原型、前端、内容数据到部署自动化的闭环',
  '把个人知识、项目、想法和行动沉淀成长期操作系统'
];

const profile = [
  { label: '我是谁', text: 'Pigou Wu，一个长期围绕教育现场、AI 工具和个人操作系统做产品实验的人。' },
  { label: '我在解决什么', text: '教师日常里有很多重复记录、分析、沟通和归档，我关心的是如何把这些真实问题变成可持续使用的工具。' },
  { label: '我的工作方式', text: '先从场景里找痛点，再做可用原型，用真实截图、状态、更新日志和部署结果证明进展。' }
];

const resumeBlocks = [
  { title: '教育场景理解', text: '关注班主任管理、教学数据、教师工作流和学校内部协作，不把 AI 停在聊天窗口里。' },
  { title: 'AI 产品化', text: '把 LLM、数据分析、知识结构和自动化流程接进真实工具，让 AI 能进入日常工作。' },
  { title: '全栈交付', text: '能从 Next.js 界面、内容数据、GitHub Actions、VPS 部署到公开/私有边界一起处理。' },
  { title: '个人知识系统', text: '用自己的项目站持续记录想法、任务、日志和作品，不断把经验沉淀成可复用资产。' }
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
            <h2 className="mt-8 max-w-[10ch] text-5xl font-semibold leading-[.92] text-white md:text-8xl">我在把教育现场的问题，做成 AI 工具和个人系统。</h2>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/62">如果你想快速理解我：我不是只写“AI 很重要”的人，我更关心一个工具能不能真的帮教师少一点重复劳动，多一点判断空间。</p>
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
