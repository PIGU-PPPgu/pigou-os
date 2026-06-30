import type { Project } from '@/lib/data';

export function hasPublicProjectProof(project: Project): boolean {
  return Boolean(project.images?.some(image => image.public === true));
}

export function isPublicProject(project: Project): boolean {
  return project.status !== 'archived' && hasPublicProjectProof(project);
}

export function getPublicProjects(projects: Project[]): Project[] {
  return projects.filter(isPublicProject);
}
