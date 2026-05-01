import { NextResponse } from 'next/server';
import { buildLlmWikiGraph } from '@/lib/llm-wiki-store';
import { getIdeas, getKnowledge, getLlmWikiGraph, getProjects, getTasks } from '@/lib/data';

export async function GET() {
  const stored = getLlmWikiGraph();
  if (stored) return NextResponse.json({ ok: true, graph: stored, source: 'stored' });
  const graph = await buildLlmWikiGraph({ projects: getProjects(), ideas: getIdeas(), knowledge: getKnowledge(), tasks: getTasks() });
  return NextResponse.json({ ok: true, graph, source: 'generated' });
}
