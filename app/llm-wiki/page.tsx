import { LlmWikiWorkbench } from '@/components/LlmWikiWorkbench';
import { getIdeas, getKnowledge, getLlmWikiGraph, getProjects, getTasks } from '@/lib/data';
import { buildLlmWikiGraph } from '@/lib/llm-wiki-store';

export const dynamic = 'force-dynamic';

export default async function LlmWikiPage() {
  const graph = getLlmWikiGraph() || await buildLlmWikiGraph({ projects: getProjects(), ideas: getIdeas(), knowledge: getKnowledge(), tasks: getTasks() });
  return <LlmWikiWorkbench graph={graph} />;
}
