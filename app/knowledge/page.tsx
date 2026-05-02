import { Label, Panel } from '@/components/UI';
import { KnowledgeBoard } from '@/components/KnowledgeBoard';
import { getKnowledge } from '@/lib/data';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="知识大脑" />;
  const notes = getKnowledge();
  const linked = notes.filter(note => note.status === 'linked').length;
  const raw = notes.filter(note => note.status === 'raw').length;

  return <div className="grid gap-5">
    <Panel dark className="console-screen relative min-h-[360px] overflow-hidden p-6 md:p-8">
      <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
      <div className="scanline" />
      <div className="relative grid h-full gap-8 lg:grid-cols-[1fr_300px] lg:items-end">
        <div>
          <Label>知识 / 私有大脑</Label>
          <h2 className="mt-8 max-w-[9ch] text-5xl font-semibold leading-[.92] text-white sm:max-w-3xl md:text-8xl">知识大脑</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <div className="border-t border-white/15 pt-4">
            <div className="caption text-white/40">已关联笔记</div>
            <div className="doto mt-2 text-6xl leading-none text-white">{String(linked).padStart(2, '0')}</div>
          </div>
          <div className="border-t border-white/15 pt-4">
            <div className="caption text-white/40">原始收件箱</div>
            <div className="doto mt-2 text-6xl leading-none text-white">{String(raw).padStart(2, '0')}</div>
          </div>
        </div>
      </div>
    </Panel>

    <KnowledgeBoard notes={notes} />
  </div>;
}
