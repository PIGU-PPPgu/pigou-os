import fs from 'node:fs';
import path from 'node:path';

const appApiDir = path.join(process.cwd(), 'app', 'api');
const disabledDir = path.join(process.cwd(), '.static-export-disabled-api');
const appDir = path.join(process.cwd(), 'app');

if (process.env.GITHUB_PAGES !== 'true' && process.env.STATIC_EXPORT !== 'true') {
  process.exit(0);
}

if (!fs.existsSync(appApiDir)) {
  process.exit(0);
}

fs.rmSync(disabledDir, { recursive: true, force: true });
fs.renameSync(appApiDir, disabledDir);
console.log('[static-export] temporarily moved app/api out of the App Router build.');

const shellFile = path.join(process.cwd(), 'components', 'Shell.tsx');
const files = [...pageFiles(appDir), ...(fs.existsSync(shellFile) ? [shellFile] : [])];

for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  source = source.replace(/export const dynamic = 'force-dynamic';\n/g, "export const dynamic = 'force-static';\n");
  source = replacePrivatePageWithLock(source);
  source = source.replace(/import \{ cookies \} from 'next\/headers';\n/g, '');
  source = source.replace(/import \{ getSessionUserFromCookieHeader \} from '@\/lib\/auth';\n/g, '');
  source = source.replace(/  const cookieHeader = \(await cookies\(\)\)\.toString\(\);\n  const isLoggedIn = Boolean\(getSessionUserFromCookieHeader\(cookieHeader\)\);\n/g, '  const isLoggedIn = false;\n');

  if (source !== original) {
    fs.writeFileSync(file, source);
    console.log(`[static-export] patched ${path.relative(process.cwd(), file)}`);
  }
}

function pageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...pageFiles(full));
    if (entry.isFile() && entry.name === 'page.tsx') files.push(full);
  }
  return files;
}

function replacePrivatePageWithLock(source) {
  const match = source.match(/export default async function ([A-Za-z0-9_]+)\(\) \{\n  const cookieHeader = \(await cookies\(\)\)\.toString\(\);\n  if \(!getSessionUserFromCookieHeader\(cookieHeader\)\) return (<InternalLock title="[^"]+" \/>);/);
  if (!match || match.index === undefined) return source;

  const openBrace = source.indexOf('{', match.index);
  if (openBrace === -1) return source;

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      const replacement = `export default async function ${match[1]}() {\n  return ${match[2]};\n}`;
      return `${source.slice(0, match.index)}${replacement}${source.slice(index + 1)}`;
    }
  }

  return source;
}
