import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { appendOpsEvent, writeOpsJson } from '../lib/ops-store.mjs';

loadEnvLocal();

const owner = process.env.GITHUB_OWNER || 'PIGU-PPPgu';
const days = Number(process.env.PIGOU_GITHUB_ACTIVITY_DAYS || '21');
const since = new Date(Date.now() - days * 86400000).toISOString();
const activityDir = path.join(process.cwd(), 'content', 'activity');
const projectDir = path.join(process.cwd(), 'content', 'projects');
const outputPath = path.join(activityDir, 'github-events.json');

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function slugify(input) {
  return input.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadProjectMap() {
  if (!fs.existsSync(projectDir)) return new Map();
  const projects = fs.readdirSync(projectDir)
    .filter(file => file.endsWith('.json'))
    .map(file => readJson(path.join(projectDir, file)));
  const map = new Map();
  for (const project of projects) {
    map.set(project.slug, project.slug);
    const source = String(project.source || '').toLowerCase();
    const links = (project.links || []).map(link => String(link.url || '').toLowerCase());
    for (const value of [source, ...links]) {
      const match = value.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/) || value.match(/github:([^/\s]+)\/([^/#?\s]+)/);
      if (match) map.set(`${match[1].toLowerCase()}/${match[2].toLowerCase().replace(/\.git$/, '')}`, project.slug);
    }
  }
  return map;
}

function projectSlugFor(repo, projectMap) {
  return projectMap.get(`${owner.toLowerCase()}/${repo.name.toLowerCase()}`) || projectMap.get(slugify(repo.name)) || slugify(repo.name);
}

function loadCommits(repo) {
  try {
    return JSON.parse(runGh([
      'api',
      '--method',
      'GET',
      `repos/${owner}/${repo.name}/commits`,
      '-f',
      `since=${since}`,
      '-f',
      'per_page=20'
    ]));
  } catch (error) {
    appendOpsEvent({ type: 'github-activity-repo-failed', repo: `${owner}/${repo.name}`, error: error.message });
    return [];
  }
}

const startedAt = new Date().toISOString();
const projectMap = loadProjectMap();
const repos = JSON.parse(runGh(['repo', 'list', owner, '--limit', '100', '--json', 'name,isFork,isPrivate,pushedAt,url']));
const events = [];

for (const repo of repos) {
  if (repo.isFork) continue;
  if (repo.pushedAt && Date.parse(repo.pushedAt) < Date.parse(since)) continue;
  const projectSlug = projectSlugFor(repo, projectMap);
  for (const commit of loadCommits(repo)) {
    const sha = String(commit.sha || '');
    if (!sha) continue;
    events.push({
      id: `${repo.name}-${sha.slice(0, 12)}`,
      type: 'commit',
      repo: {
        owner,
        name: repo.name,
        fullName: `${owner}/${repo.name}`,
        url: repo.url || `https://github.com/${owner}/${repo.name}`,
        private: Boolean(repo.isPrivate)
      },
      projectSlug,
      sha,
      message: String(commit.commit?.message || '').split('\n')[0].trim() || 'Commit',
      url: commit.html_url || `${repo.url || `https://github.com/${owner}/${repo.name}`}/commit/${sha}`,
      authorDate: commit.commit?.author?.date || commit.commit?.committer?.date || repo.pushedAt || startedAt
    });
  }
}

events.sort((a, b) => b.authorDate.localeCompare(a.authorDate) || a.repo.fullName.localeCompare(b.repo.fullName));
const feed = {
  owner,
  generatedAt: new Date().toISOString(),
  since,
  events: events.slice(0, 240)
};

fs.mkdirSync(activityDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(feed, null, 2)}\n`);
writeOpsJson('last-github-activity-sync', {
  generatedAt: feed.generatedAt,
  startedAt,
  owner,
  since,
  repos: repos.filter(repo => !repo.isFork).length,
  events: feed.events.length
});
appendOpsEvent({ type: 'github-activity-sync-success', owner, events: feed.events.length, since });
console.log(`Synced ${feed.events.length} GitHub activity event(s) for ${owner}.`);
