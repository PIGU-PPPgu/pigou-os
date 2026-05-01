import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const owner = process.env.GITHUB_OWNER || 'PIGU-PPPgu';
const dir = path.join(process.cwd(), 'content', 'projects');
const existing = new Set(fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => file.replace(/\.json$/, '')));
const help = process.argv.includes('--help') || process.argv.includes('-h');
const dryRun = process.argv.includes('--dry-run');

if (help) {
  console.log('Usage: pnpm sync:github [--dry-run]');
  console.log('Creates draft content/projects/*.json for own GitHub repos that do not already exist. Existing files are never overwritten.');
  process.exit(0);
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readReadme(repo) {
  try {
    const encoded = runGh(['api', `repos/${owner}/${repo}/readme`, '--jq', '.content']).replace(/\\n/g, '');
    const text = Buffer.from(encoded, 'base64').toString('utf8');
    return text
      .replace(/```[\s\S]*?```/g, '')
      .split(/\n{2,}/)
      .map(part => part.replace(/^#+\s*/gm, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[[^\]]+\]\([^)]+\)/g, '').replace(/[*_`>#|]/g, '').trim())
      .filter(part => part.length > 25)
      .slice(0, 4);
  } catch {
    return [];
  }
}

const repos = JSON.parse(runGh(['repo', 'list', owner, '--limit', '100', '--json', 'name,description,isPrivate,isFork,updatedAt,url,primaryLanguage']));
let created = 0;

for (const repo of repos) {
  if (repo.isFork) continue;
  const slug = slugify(repo.name);
  if (!slug || existing.has(slug)) continue;

  const readme = readReadme(repo.name);
  const isPrivate = Boolean(repo.isPrivate);
  const project = {
    slug,
    title: repo.name,
    status: 'idea',
    priority: 'medium',
    summary: repo.description || `${repo.name} project imported from GitHub.`,
    domain: repo.primaryLanguage?.name ? repo.primaryLanguage.name.toLowerCase() : 'github-project',
    visibility: isPrivate ? 'private' : 'public',
    source: `${isPrivate ? 'private' : 'github'}:${owner}/${repo.name}`,
    readme,
    progress: readme.length ? 35 : 20,
    goals: ['整理项目定位', '补充 README 摘要', '确认展示边界'],
    nextActions: ['检查自动导入内容', '补充项目截图', '手动校准进度和状态'],
    ...(isPrivate ? {} : { links: [{ label: 'GitHub', url: repo.url }] }),
    updated: repo.updatedAt.slice(0, 10)
  };

  if (!dryRun) {
    fs.writeFileSync(path.join(dir, `${slug}.json`), `${JSON.stringify(project, null, 2)}\n`);
  }
  created += 1;
  console.log(`${dryRun ? 'Would create' : 'Created'} content/projects/${slug}.json`);
}

console.log(created ? `${dryRun ? 'Would create' : 'Created'} ${created} new project draft(s).` : 'No new project drafts.');
