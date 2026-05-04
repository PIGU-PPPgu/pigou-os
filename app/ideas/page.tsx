import { IdeasWorkbench } from '@/components/IdeasWorkbench';
import { getIdeas, getProjects } from '@/lib/data';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function IdeasPage() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="想法工作台" />;
  return <IdeasWorkbench ideas={getIdeas()} projects={getProjects()} />;
}
