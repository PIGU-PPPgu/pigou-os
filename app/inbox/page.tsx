import { InboxWorkbench } from '@/components/InboxWorkbench';
import { getIdeas, getKnowledge, getLogs, getTasks } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  return <InboxWorkbench stats={{
    knowledge: getKnowledge().length,
    ideas: getIdeas().length,
    tasks: getTasks().length,
    logs: getLogs().length
  }} />;
}
