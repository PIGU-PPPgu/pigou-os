import { LlmWikiWorkbench } from '@/components/LlmWikiWorkbench';
import { getIdeas, getKnowledge, getLlmWikiGraph, getProjects, getTasks } from '@/lib/data';
import { buildLlmWikiGraph } from '@/lib/llm-wiki-store';
import { InternalLock } from '@/components/InternalLock';
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LlmWikiPage() {
  const cookieHeader = (await cookies()).toString();
  if (!getSessionUserFromCookieHeader(cookieHeader)) return <InternalLock title="LLM Wiki" />;
  const graph = getLlmWikiGraph() || await buildLlmWikiGraph({ projects: getProjects(), ideas: getIdeas(), knowledge: getKnowledge(), tasks: getTasks() });
  return <LlmWikiWorkbench graph={graph} />;
}
