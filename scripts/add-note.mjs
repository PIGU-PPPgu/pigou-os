import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const title = args[0];
const summary = args[1];

function readFlag(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

if (!title || !summary) {
  console.error('Usage: pnpm note "标题" "摘要" --type insight --tags education,agent --project pigou-os --next "下一步"');
  process.exit(1);
}

const slug = readFlag('slug', slugify(title));
const file = path.join(process.cwd(), 'content', 'knowledge', `${slug}.json`);
if (fs.existsSync(file)) {
  console.error(`Knowledge note already exists: ${file}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const note = {
  slug,
  title,
  type: readFlag('type', 'insight'),
  status: readFlag('status', 'raw'),
  summary,
  keyPoints: readFlag('points', '').split('|').map(point => point.trim()).filter(Boolean),
  tags: readFlag('tags', 'inbox').split(',').map(tag => tag.trim()).filter(Boolean),
  relatedProjects: readFlag('project', '').split(',').map(project => project.trim()).filter(Boolean),
  sourceUrl: readFlag('source', '') || undefined,
  confidence: readFlag('confidence', 'medium'),
  next: readFlag('next', 'Link this note to a project, idea, or decision.'),
  capturedAt: today,
  updated: today
};

fs.writeFileSync(file, `${JSON.stringify(note, null, 2)}\n`);
console.log(`Created ${file}`);
