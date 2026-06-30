import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { getProjects, getUpdates } from '@/lib/data';
import TodayPage from './today/page';
import { PublicHomepage } from '@/components/home/PublicHomepage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  if (isLoggedIn) return <TodayPage />;

  return <PublicHomepage projects={getProjects()} updates={getUpdates()} />;
}
