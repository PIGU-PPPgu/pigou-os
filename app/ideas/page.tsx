import { IdeasWorkbench } from '@/components/IdeasWorkbench';
import { getIdeas } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default function IdeasPage() {
  return <IdeasWorkbench ideas={getIdeas()} />;
}
