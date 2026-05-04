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
  console.error('Usage: pnpm idea "想法标题" "一句话说明" --tags education,agent --score 70 --project headteacher-helper --next "下一步"');
  process.exit(1);
}

const slug = readFlag('slug', slugify(title));
const file = path.join(process.cwd(), 'content', 'ideas', `${slug}.json`);
if (fs.existsSync(file)) {
  console.error(`Idea already exists: ${file}`);
  process.exit(1);
}

const idea = {
  slug,
  title,
  status: readFlag('status', 'spark'),
  score: Number(readFlag('score', '60')),
  summary,
  tags: readFlag('tags', 'inbox').split(',').map(tag => tag.trim()).filter(Boolean),
  projectSlug: readFlag('project', '') || undefined,
  next: readFlag('next', '补充使用场景和判断标准。'),
  updated: new Date().toISOString().slice(0, 10)
};

fs.writeFileSync(file, `${JSON.stringify(idea, null, 2)}\n`);
console.log(`Created ${file}`);
