import { NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { getLogs, getProject, getProjectWikiSnapshot, getProjects, getTasks, type ProjectPrioritySuggestionReview } from '@/lib/data';
import { suggestProjectPriority, type ProjectPriorityAdvice } from '@/lib/project-priority';
import { updateProject } from '@/lib/project-store';
import { StorageConfigurationError } from '@/lib/storage-guard';

export const runtime = 'nodejs';

async function suggestions() {
  const tasks = getTasks();
  const logs = getLogs();
  const projects = getProjects();
  const results: ProjectPriorityAdvice[] = [];
  for (let index = 0; index < projects.length; index += 6) {
    const batch = projects.slice(index, index + 6);
    results.push(...batch.map(project => suggestProjectPriority({
      project,
      wiki: getProjectWikiSnapshot(project.slug),
      tasks: tasks.filter(task => task.projectSlug === project.slug || task.sourceSlug === project.slug),
      logs: logs.filter(log => log.tags.includes(project.slug) || log.content.toLowerCase().includes(project.slug.toLowerCase()))
    })));
  }
  return results;
}

function localDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

function reviewFromSuggestion(suggestion: ProjectPriorityAdvice, action: ProjectPrioritySuggestionReview['action']): ProjectPrioritySuggestionReview {
  return {
    id: suggestion.id,
    action,
    reviewedAt: localDate(),
    suggestedPriority: suggestion.suggestedPriority,
    confidence: suggestion.confidence,
    evidence: suggestion.evidence.slice(0, 8),
    rationale: suggestion.rationale
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
  const suggestion = body?.suggestion?.slug === slug ? body.suggestion as ProjectPriorityAdvice : (await suggestions()).find(item => item.slug === slug);
  if (!suggestion) return NextResponse.json({ ok: false, message: 'Suggestion not found.' }, { status: 404 });

  try {
    if (action === 'ignore') {
      const updated = await updateProject({
        ...project,
        prioritySuggestion: suggestion.suggestion,
        prioritySuggestionReview: reviewFromSuggestion(suggestion, 'ignored')
      });
      return NextResponse.json({ ok: true, action, project: updated, suggestion });
    }

    const updated = await updateProject({
      ...project,
      priority: suggestion.suggestedPriority,
      prioritySuggestion: suggestion.suggestion,
      prioritySuggestionReview: reviewFromSuggestion(suggestion, 'applied')
    });
    return NextResponse.json({ ok: true, action, project: updated, suggestion });
  } catch (error) {
    if (error instanceof StorageConfigurationError) return NextResponse.json({ ok: false, message: error.message }, { status: 501 });
    throw error;
  }
}
