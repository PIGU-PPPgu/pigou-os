import fs from 'node:fs/promises';
import path from 'node:path';
import type { Idea, KnowledgeNote, LlmWikiGraph, Project, Task } from '@/lib/data';
import { createChatJson, getLlmConfig } from '@/lib/ai-clients';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

type LlmWikiBuildInput = { projects: Project[]; ideas: Idea[]; knowledge: KnowledgeNote[]; tasks: Task[]; scope?: LlmWikiGraph['scope']; withAi?: boolean; today?: string };

function graphDir() {
  return path.join(process.cwd(), 'content', 'llm-wiki');
}

function nowIso() {
  return new Date().toISOString();
}

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

function normalizeTopic(input: string) {
  return input.toLowerCase().replace(/^#/, '').trim();
}

function topTopics(knowledge: KnowledgeNote[], ideas: Idea[], projects: Project[]) {
  const counts = new Map<string, number>();
  for (const note of knowledge) for (const tag of note.tags) counts.set(normalizeTopic(tag), (counts.get(normalizeTopic(tag)) || 0) + 1);
  for (const idea of ideas) for (const tag of idea.tags) counts.set(normalizeTopic(tag), (counts.get(normalizeTopic(tag)) || 0) + 1);
  for (const project of projects) if (project.domain) counts.set(normalizeTopic(project.domain), (counts.get(normalizeTopic(project.domain)) || 0) + 1);
  return Array.from(counts, ([topic, count]) => ({ topic, count })).filter(item => item.topic).sort((a, b) => b.count - a.count).slice(0, 14);
}

function hasTopic(text: string, topic: string) {
  return text.toLowerCase().includes(topic.toLowerCase());
}

function nodeId(type: string, slug: string) {
  return `${type}:${slug}`;
}

function addEdge(edges: LlmWikiGraph['edges'], edge: LlmWikiGraph['edges'][number]) {
  if (edge.from === edge.to) return;
  if (edges.some(item => item.from === edge.from && item.to === edge.to && item.type === edge.type)) return;
  edges.push(edge);
}

function updatedOn(value: string | undefined, today: string) {
  return Boolean(value && value.slice(0, 10) === today);
}

function nodeFreshnessScore(node: LlmWikiGraph['nodes'][number], todayIds: Set<string>) {
  if (todayIds.has(node.id)) return 8;
  if (node.type === 'task' && node.status !== 'done' && node.status !== 'archived') return 2;
  if (node.type === 'project' && node.status === 'building') return 2;
  if (node.type === 'idea' && (node.status === 'building' || node.status === 'validated')) return 2;
  if (node.type === 'knowledge' && (node.status === 'raw' || node.status === 'linked')) return 1;
  return 0;
}

function buildNotableConnections(graph: Pick<LlmWikiGraph, 'nodes' | 'edges'>, todayIds: Set<string>) {
  const nodeMap = new Map(graph.nodes.map(node => [node.id, node]));
  const confidenceWeight: Record<LlmWikiGraph['edges'][number]['confidence'], number> = { low: 1, medium: 2, high: 3 };
  const typeWeight: Record<LlmWikiGraph['edges'][number]['type'], number> = { supports: 5, validates: 5, becomes: 4, blocks: 4, inspires: 3, relates: 2 };

  return graph.edges
    .map(edge => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      const todayLinked = todayIds.has(edge.from) || todayIds.has(edge.to);
      const score = confidenceWeight[edge.confidence] * 3 + typeWeight[edge.type] + nodeFreshnessScore(fromNode || { id: '', type: 'topic', title: '' }, todayIds) + nodeFreshnessScore(toNode || { id: '', type: 'topic', title: '' }, todayIds);
      const label = fromNode && toNode ? `${fromNode.title} -> ${toNode.title}` : `${edge.from} -> ${edge.to}`;
      return { edge, score, todayLinked, label };
    })
    .filter(item => item.todayLinked || item.edge.confidence === 'high')
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 3)
    .map(item => {
      const fromNode = nodeMap.get(item.edge.from);
      const toNode = nodeMap.get(item.edge.to);
      return {
        from: item.edge.from,
        to: item.edge.to,
        type: item.edge.type,
        reason: item.edge.reason,
        confidence: item.edge.confidence,
        note: fromNode && toNode ? `${fromNode.title} -> ${toNode.title}` : undefined
      };
    });
}

async function aiGraphAnalysis(graph: LlmWikiGraph) {
  if (!getLlmConfig().apiKey) return graph.analysis;
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'clusters', 'nextActions'],
    properties: {
      summary: { type: 'string' },
      clusters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['topic', 'nodes', 'reason'],
          properties: {
            topic: { type: 'string' },
            nodes: { type: 'array', items: { type: 'string' } },
            reason: { type: 'string' }
          }
        }
      },
      nextActions: { type: 'array', items: { type: 'string' } }
    }
  };
  const parsed = await createChatJson<LlmWikiGraph['analysis']>({
    schemaName: 'pigou_llm_wiki_graph_analysis',
    schema,
    messages: [
      { role: 'system', content: '你是 Pigou OS 的 LLM Wiki 图谱分析器。根据节点和边总结知识脑结构、主题簇和下一步行动。中文输出，简洁可执行。' },
      { role: 'user', content: JSON.stringify({ nodes: graph.nodes.slice(0, 80), edges: graph.edges.slice(0, 160) }, null, 2) }
    ]
  }).catch(() => null);
  return parsed || graph.analysis;
}

export async function buildLlmWikiGraph(input: LlmWikiBuildInput) {
  const scope = input.scope || 'all';
  const projects = scope === 'knowledge' || scope === 'ideas' ? [] : input.projects;
  const ideas = scope === 'knowledge' || scope === 'projects' ? [] : input.ideas;
  const knowledge = scope === 'ideas' || scope === 'projects' ? [] : input.knowledge;
  const tasks = scope === 'projects' ? [] : input.tasks;
  const today = input.today || localDate();
  const todayIds = new Set<string>();
  for (const project of projects) if (updatedOn(project.updated, today)) todayIds.add(nodeId('project', project.slug));
  for (const idea of ideas) if (updatedOn(idea.updated, today) || updatedOn(idea.analyzedAt, today)) todayIds.add(nodeId('idea', idea.slug));
  for (const note of knowledge) if (updatedOn(note.updated, today) || updatedOn(note.capturedAt, today) || updatedOn(note.analyzedAt, today)) todayIds.add(nodeId('knowledge', note.slug));
  for (const task of tasks) if (updatedOn(task.updated, today) || updatedOn(task.createdAt, today) || updatedOn(task.due, today)) todayIds.add(nodeId('task', task.slug));
  const topics = topTopics(knowledge, ideas, projects);
  const nodes: LlmWikiGraph['nodes'] = [
    ...projects.map((project, index) => ({ id: nodeId('project', project.slug), type: 'project' as const, title: project.title, summary: project.summary, status: project.status, score: project.progress, x: 120 + (index % 3) * 220, y: 110 + Math.floor(index / 3) * 115 })),
    ...ideas.map((idea, index) => ({ id: nodeId('idea', idea.slug), type: 'idea' as const, title: idea.title, summary: idea.summary, status: idea.status, score: idea.score, x: 170 + (index % 3) * 240, y: 430 + Math.floor(index / 3) * 115 })),
    ...knowledge.map((note, index) => ({ id: nodeId('knowledge', note.slug), type: 'knowledge' as const, title: note.title, summary: note.summary, status: note.status, platform: note.platform, x: 760 + (index % 2) * 260, y: 100 + Math.floor(index / 2) * 100 })),
    ...tasks.map((task, index) => ({ id: nodeId('task', task.slug), type: 'task' as const, title: task.title, summary: task.summary, status: task.status, x: 760 + (index % 2) * 260, y: 560 + Math.floor(index / 2) * 95 })),
    ...topics.map((topic, index) => ({ id: nodeId('topic', topic.topic), type: 'topic' as const, title: topic.topic, summary: `${topic.count} signal(s)`, x: 490 + (index % 2) * 190, y: 170 + Math.floor(index / 2) * 95 }))
  ];
  const edges: LlmWikiGraph['edges'] = [];
  const topicSet = new Set(topics.map(topic => topic.topic));

  for (const note of knowledge) {
    for (const projectSlug of [...(note.relatedProjects || []), ...(note.analysis?.projectLinks || [])]) {
      addEdge(edges, { from: nodeId('knowledge', note.slug), to: nodeId('project', projectSlug), type: 'supports', reason: note.analysis?.relationReasoning || 'Knowledge note is linked to this project.', confidence: note.analysis?.confidence || note.confidence });
    }
    for (const ideaSlug of note.analysis?.ideaLinks || []) {
      addEdge(edges, { from: nodeId('knowledge', note.slug), to: nodeId('idea', ideaSlug), type: 'validates', reason: 'Knowledge analysis links this note to the idea.', confidence: note.analysis?.confidence || note.confidence });
    }
    for (const tag of note.tags.map(normalizeTopic).filter(tag => topicSet.has(tag))) {
      addEdge(edges, { from: nodeId('knowledge', note.slug), to: nodeId('topic', tag), type: 'relates', reason: `Shared topic: ${tag}`, confidence: 'medium' });
    }
  }

  for (const idea of ideas) {
    for (const evidenceSlug of idea.relatedKnowledge || idea.analysis?.evidenceLinks || []) {
      addEdge(edges, { from: nodeId('knowledge', evidenceSlug), to: nodeId('idea', idea.slug), type: 'validates', reason: 'Idea analysis uses this knowledge as evidence.', confidence: 'medium' });
    }
    const projectSlug = idea.projectSlug || idea.analysis?.suggestedProject;
    if (projectSlug) {
      addEdge(edges, { from: nodeId('idea', idea.slug), to: nodeId('project', projectSlug), type: 'becomes', reason: idea.projectSlug ? 'Idea was manually assigned to this project.' : 'Idea analysis suggests this project target.', confidence: idea.projectSlug ? 'high' : 'medium' });
    }
    for (const tag of idea.tags.map(normalizeTopic).filter(tag => topicSet.has(tag))) {
      addEdge(edges, { from: nodeId('idea', idea.slug), to: nodeId('topic', tag), type: 'inspires', reason: `Idea carries topic: ${tag}`, confidence: 'medium' });
    }
  }

  for (const task of tasks) {
    addEdge(edges, { from: nodeId(task.sourceType, task.sourceSlug), to: nodeId('task', task.slug), type: 'becomes', reason: 'Task was generated from this source.', confidence: 'high' });
    if (task.projectSlug) addEdge(edges, { from: nodeId('task', task.slug), to: nodeId('project', task.projectSlug), type: 'relates', reason: 'Task is assigned to this project.', confidence: 'high' });
  }

  for (const project of projects) {
    const text = `${project.title}\n${project.summary}\n${project.domain || ''}`;
    for (const topic of topics.filter(topic => hasTopic(text, topic.topic)).slice(0, 3)) {
      addEdge(edges, { from: nodeId('project', project.slug), to: nodeId('topic', topic.topic), type: 'relates', reason: `Project matches topic: ${topic.topic}`, confidence: 'low' });
    }
  }

  const filteredEdges = edges.filter(edge => nodes.some(node => node.id === edge.from) && nodes.some(node => node.id === edge.to)).slice(0, 240);
  const notableConnections = buildNotableConnections({ nodes, edges: filteredEdges }, todayIds);

  const graph: LlmWikiGraph = {
    slug: 'current',
    generatedAt: nowIso(),
    scope,
    nodes,
    edges: filteredEdges,
    analysis: {
      summary: `Built from ${projects.length} project(s), ${ideas.length} idea(s), ${knowledge.length} knowledge note(s), and ${tasks.length} task(s).`,
      clusters: topics.slice(0, 6).map(topic => ({ topic: topic.topic, nodes: nodes.filter(node => hasTopic(`${node.title}\n${node.summary || ''}`, topic.topic)).map(node => node.id).slice(0, 8), reason: 'Shared tags, domains, titles, or summaries.' })),
      nextActions: ['重建图谱后优先查看高置信 edge。', '把高信号 idea 转为 task 或 project。', '补齐 raw knowledge 的平台和分析。'],
      notableConnections
    }
  };

  if (input.withAi && graph.analysis) {
    const fallbackAnalysis = graph.analysis;
    const aiAnalysis = await aiGraphAnalysis(graph);
    graph.analysis = { ...fallbackAnalysis, ...(aiAnalysis || {}), notableConnections };
  }
  return graph;
}

export async function writeLlmWikiGraph(graph: LlmWikiGraph) {
  assertDurableLocalWrites();
  await fs.mkdir(graphDir(), { recursive: true });
  await fs.writeFile(path.join(graphDir(), 'current.json'), `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
  return graph;
}
