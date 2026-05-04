import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { createTask, updateTask } from '@/lib/task-store';
import { getIdea, getKnowledgeNote, getProject, getTask } from '@/lib/data';
import { StorageConfigurationError } from '@/lib/storage-guard';

const statuses = ['next', 'doing', 'waiting', 'done', 'archived'] as const;
const priorities = ['P0', 'P1', 'P2'] as const;
const sourceTypes = ['knowledge', 'idea', 'project', 'manual'] as const;

function deriveTask(body: Record<string, unknown>) {
  const sourceType = sourceTypes.includes(body.sourceType as never) ? body.sourceType as typeof sourceTypes[number] : 'manual';
  const sourceSlug = typeof body.sourceSlug === 'string' && body.sourceSlug.trim() ? body.sourceSlug.trim() : 'manual';
  let title = typeof body.title === 'string' ? body.title.trim() : '';
  let summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  let projectSlug = typeof body.projectSlug === 'string' && body.projectSlug.trim() ? body.projectSlug.trim() : undefined;

  if (!title && sourceType === 'knowledge') {
    const note = getKnowledgeNote(sourceSlug);
    title = note?.analysis?.actionSuggestions?.[0] || note?.next || `处理知识：${note?.title || sourceSlug}`;
    summary = summary || note?.summary || '';
    projectSlug = projectSlug || note?.analysis?.projectLinks?.[0] || note?.relatedProjects?.[0];
  }
  if (!title && sourceType === 'idea') {
    const idea = getIdea(sourceSlug);
    title = idea?.analysis?.nextExperiment || idea?.next || `验证想法：${idea?.title || sourceSlug}`;
    summary = summary || idea?.summary || '';
    projectSlug = projectSlug || idea?.projectSlug || idea?.analysis?.suggestedProject;
  }
  if (!title && sourceType === 'project') {
    const project = getProject(sourceSlug);
    title = project?.nextActions?.[0] || `推进项目：${project?.title || sourceSlug}`;
    summary = summary || project?.summary || '';
    projectSlug = projectSlug || sourceSlug;
  }

  return { sourceType, sourceSlug, title, summary, projectSlug };
}

export async function POST(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, message: 'Invalid task payload.' }, { status: 400 });
  const derived = deriveTask(body);
  if (!derived.title) return NextResponse.json({ ok: false, message: 'Task title is required.' }, { status: 400 });

  try {
    const task = await createTask({
      title: derived.title,
      status: statuses.includes(body.status as never) ? body.status as typeof statuses[number] : 'next',
      priority: priorities.includes(body.priority as never) ? body.priority as typeof priorities[number] : 'P1',
      sourceType: derived.sourceType,
      sourceSlug: derived.sourceSlug,
      projectSlug: derived.projectSlug,
      summary: derived.summary || 'Generated from Pigou OS source signal.',
      due: typeof body.due === 'string' && body.due.trim() ? body.due.trim() : undefined
    });
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const task = getTask(slug);
  if (!task) return NextResponse.json({ ok: false, message: 'Task not found.' }, { status: 404 });

  try {
    const updated = await updateTask({
      ...task,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : task.title,
      status: statuses.includes(body?.status as never) ? body?.status as typeof statuses[number] : task.status,
      priority: priorities.includes(body?.priority as never) ? body?.priority as typeof priorities[number] : task.priority,
      projectSlug: typeof body?.projectSlug === 'string' ? body.projectSlug.trim() || undefined : task.projectSlug,
      summary: typeof body?.summary === 'string' && body.summary.trim() ? body.summary.trim() : task.summary,
      due: typeof body?.due === 'string' ? body.due.trim() || undefined : task.due
    });
    return NextResponse.json({ ok: true, task: updated });
  } catch (error) {
    if (error instanceof StorageConfigurationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    }
    throw error;
  }
}
