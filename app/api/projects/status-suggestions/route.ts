import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getLogs, getProject, getProjectWikiSnapshot, getProjects, getTasks, type ProjectStatusSuggestionReview } from '@/lib/data';
import { suggestProjectStatus, type ProjectStatusSuggestion } from '@/lib/project-status';
import { updateProject } from '@/lib/project-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

export const runtime = 'nodejs';

async function suggestions() {
  const tasks = getTasks();
  const logs = getLogs();
  const projects = getProjects();
  const results: ProjectStatusSuggestion[] = [];
  for (let index = 0; index < projects.length; index += 3) {
    const batch = projects.slice(index, index + 3);
    results.push(...await Promise.all(batch.map(project => suggestProjectStatus({
      project,
      wiki: getProjectWikiSnapshot(project.slug),
      tasks: tasks.filter(task => task.projectSlug === project.slug || task.sourceSlug === project.slug),
      logs: logs.filter(log => log.tags.includes(project.slug) || log.content.toLowerCase().includes(project.slug.toLowerCase()))
    }))));
  }
  return results;
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function reviewFromSuggestion(suggestion: ProjectStatusSuggestion, action: ProjectStatusSuggestionReview['action']): ProjectStatusSuggestionReview {
  return {
    id: suggestion.id,
    action,
    reviewedAt: localDate(),
    suggestedStatus: suggestion.suggestedStatus,
    suggestedProgress: suggestion.suggestedProgress,
    confidence: suggestion.confidence,
    evidence: suggestion.evaluation.evidence.slice(0, 8),
    summary: suggestion.evaluation.summary
  };
}

export async function GET(request: Request) {
  if (!isAuthenticatedRequest(request)) return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  const items = await suggestions();
  return NextResponse.json({ ok: true, suggestions: items.filter(item => item.changed && !item.ignored) });
}

export async function PATCH(request: Request) {
  if (!isAuthenticatedRequest(request)) return NextResponse.json({ ok: false, message: '请先登录 Pigou OS。' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
  const action = body?.action === 'ignore' ? 'ignore' : 'apply';
  const project = getProject(slug);
  if (!project) return NextResponse.json({ ok: false, message: 'Project not found.' }, { status: 404 });
  const suggestion = body?.suggestion?.slug === slug ? body.suggestion as ProjectStatusSuggestion : (await suggestions()).find(item => item.slug === slug);
  if (!suggestion) return NextResponse.json({ ok: false, message: 'Suggestion not found.' }, { status: 404 });

  try {
    if (action === 'ignore') {
      const updated = await updateProject({
        ...project,
        statusSuggestionReview: reviewFromSuggestion(suggestion, 'ignored')
      });
      return NextResponse.json({ ok: true, action, project: updated, suggestion });
    }

    const updated = await updateProject({
      ...project,
      status: suggestion.suggestedStatus,
      progress: suggestion.suggestedProgress,
      progressEvaluation: suggestion.evaluation,
      statusSuggestionReview: reviewFromSuggestion(suggestion, 'applied'),
      nextActions: suggestion.suggestedNextActions
    });
    return NextResponse.json({ ok: true, action, project: updated, suggestion });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}
