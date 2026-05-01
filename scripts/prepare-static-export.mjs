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

for (const file of pageFiles(appDir)) {
  let source = fs.readFileSync(file, 'utf8');
  const original = source;

  source = source.replace(/export const dynamic = 'force-dynamic';\n/g, "export const dynamic = 'force-static';\n");
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
