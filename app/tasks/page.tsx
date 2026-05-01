import { TasksWorkbench } from '@/components/TasksWorkbench';
import { getProjects, getTasks } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default function TasksPage() {
  return <TasksWorkbench tasks={getTasks()} projects={getProjects()} />;
}
