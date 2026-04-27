import fs from 'fs';
import path from 'path';

export type Project = {
  slug: string; title: string; status: 'idea'|'building'|'paused'|'shipped'|'archived'; priority: 'high'|'medium'|'low';
  summary: string; progress: number; goals: string[]; nextActions: string[]; links?: { label: string; url: string }[]; updated: string;
};
export type Idea = { slug: string; title: string; status: 'spark'|'validated'|'building'|'killed'; score: number; summary: string; tags: string[]; next?: string; updated: string };
export type Log = { slug: string; title: string; date: string; content: string; tags: string[] };

function readJson<T>(dir: string): T[] {
  const full = path.join(process.cwd(), 'content', dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(full, f), 'utf8')) as T);
}
export const getProjects = () => readJson<Project>('projects').sort((a,b) => b.updated.localeCompare(a.updated));
export const getIdeas = () => readJson<Idea>('ideas').sort((a,b) => b.updated.localeCompare(a.updated));
export const getLogs = () => readJson<Log>('log').sort((a,b) => b.date.localeCompare(a.date));
export const getProject = (slug: string) => getProjects().find(p => p.slug === slug);
export const getAllTasks = () => getProjects().flatMap(p => p.nextActions.map((task, i) => ({ task, project: p.title, slug: p.slug, priority: p.priority, index: i })));
