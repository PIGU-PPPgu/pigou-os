import Link from 'next/link';
import { Label, Panel } from '@/components/UI';

export function InternalLock({ title = '私人工作区' }: { title?: string }) {
  return <div className="grid gap-5">
    <Panel dark className="console-screen min-h-[430px] p-6 md:p-8">
      <Label>Private Workspace</Label>
      <h2 className="mt-8 max-w-[10ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">{title}</h2>
      <p className="mt-6 max-w-xl text-sm leading-7 text-white/55">这里放的是日常项目、想法、任务和日志，登录后再继续处理。</p>
      <Link href="/login" className="mono mt-8 inline-flex min-h-10 w-fit items-center rounded-full border border-white/40 px-4 text-[10px] uppercase text-white">登录进入</Link>
    </Panel>
  </div>;
}
