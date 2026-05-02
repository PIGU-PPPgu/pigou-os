import { LoginForm } from '@/components/auth/AuthControls';
import { Label, Panel } from '@/components/UI';

export default function LoginPage() {
  return <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
    <Panel dark className="console-screen relative min-h-[420px] overflow-hidden p-6 md:p-8">
      <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
      <div className="scanline" />
      <div className="relative flex h-full flex-col justify-between gap-10">
        <div>
          <Label>Private Workspace</Label>
          <h2 className="mt-8 max-w-[8ch] text-6xl font-semibold leading-[.9] text-white md:text-8xl">欢迎回来</h2>
        </div>
        <div className="grid gap-4 border-t border-white/15 pt-5">
          <p className="text-sm leading-7 text-white/55">登录后回到你的 Today、项目、想法和知识工作台。</p>
        </div>
      </div>
    </Panel>

    <Panel raised className="p-5 md:p-6">
      <div className="caption mb-5">进入私人工作区</div>
      <LoginForm />
    </Panel>
  </div>;
}
