import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

loadEnv('.env');
loadEnv('.env.local');

const projectsDir = path.join(process.cwd(), 'content', 'projects');
const baseUrl = (process.env.PIGOU_PUBLIC_BASE_URL || 'https://pigou-os.intellicode.top').replace(/\/+$/, '');
const webhookUrl = `${baseUrl}/api/github/webhook`;
const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
const events = ['push', 'pull_request', 'release'];

function loadEnv(file) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function githubRepoFromProject(project) {
  if (typeof project.source === 'string' && project.source.startsWith('github:')) {
    return project.source.replace('github:', '').trim();
  }
  for (const link of project.links || []) {
    const match = String(link.url || '').match(/github\.com\/([^/]+\/[^/#?]+)/i);
    if (match) return match[1].replace(/\.git$/, '');
  }
  return '';
}

function readProjects() {
  if (!fs.existsSync(projectsDir)) return [];
  return fs.readdirSync(projectsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => JSON.parse(fs.readFileSync(path.join(projectsDir, file), 'utf8')));
}

function hookExists(repo) {
  const hooks = JSON.parse(runGh(['api', `repos/${repo}/hooks`, '--paginate']));
  return hooks.some(hook => hook?.config?.url === webhookUrl);
}

function installHook(repo) {
  runGh([
    'api',
    `repos/${repo}/hooks`,
    '-X', 'POST',
    '-f', 'name=web',
    '-F', 'active=true',
    '-f', `config[url]=${webhookUrl}`,
    '-f', 'config[content_type]=json',
    '-f', 'config[insecure_ssl]=0',
    ...(secret ? ['-f', `config[secret]=${secret}`] : []),
    ...events.flatMap(event => ['-f', `events[]=${event}`])
  ]);
}

if (!secret) {
  console.log('[github-webhooks] GITHUB_WEBHOOK_SECRET is empty; GitHub payloads will not be signed.');
}

const repos = Array.from(new Set(readProjects().map(githubRepoFromProject).filter(Boolean))).sort();
let created = 0;
let skipped = 0;

for (const repo of repos) {
  try {
    if (hookExists(repo)) {
      console.log(`[github-webhooks] exists ${repo}`);
      skipped += 1;
      continue;
    }
    installHook(repo);
    console.log(`[github-webhooks] created ${repo}`);
    created += 1;
  } catch (error) {
    console.log(`[github-webhooks] failed ${repo}: ${error.stderr || error.message}`);
  }
}

console.log(`[github-webhooks] done: ${created} created, ${skipped} existing, ${repos.length} repo(s), url=${webhookUrl}`);
