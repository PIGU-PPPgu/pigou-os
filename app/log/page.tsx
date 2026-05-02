import { LogWorkbench } from '@/components/LogWorkbench';
import { getLogs, getProjects, getTasks } from '@/lib/data';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LogPage() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="日志" />;
  return <LogWorkbench logs={getLogs()} projects={getProjects()} tasks={getTasks()} />;
}
