import { headers } from 'next/headers';
import { InboxWorkbench } from '@/components/InboxWorkbench';
import { getIdeas, getKnowledge, getLogs, getTasks } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'pigou-os.intellicode.top';
  const protocol = headerList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const baseUrl = `${protocol}://${host}`;
  return <InboxWorkbench stats={{
    knowledge: getKnowledge().length,
    ideas: getIdeas().length,
    tasks: getTasks().length,
    logs: getLogs().length
  }} baseUrl={baseUrl} />;
}
