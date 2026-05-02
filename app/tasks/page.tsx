import { TasksWorkbench } from '@/components/TasksWorkbench';
import { getProjects, getTasks } from '@/lib/data';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="行动队列" />;
  return <TasksWorkbench tasks={getTasks()} projects={getProjects()} />;
}
