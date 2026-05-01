import { LogWorkbench } from '@/components/LogWorkbench';
import { getLogs, getProjects, getTasks } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default function LogPage() {
  return <LogWorkbench logs={getLogs()} projects={getProjects()} tasks={getTasks()} />;
}
