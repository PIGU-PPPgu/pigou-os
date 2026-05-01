import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectNextDir = path.join(process.cwd(), '.next');
const cacheRoot = process.env.PIGOU_NEXT_CACHE_DIR || path.join(os.homedir(), 'Library', 'Caches', 'pigou-os-next');

fs.mkdirSync(cacheRoot, { recursive: true });
fs.rmSync(path.join(cacheRoot, 'dev'), { recursive: true, force: true });

try {
  const stat = fs.lstatSync(projectNextDir);
  if (stat.isSymbolicLink()) {
    const currentTarget = fs.readlinkSync(projectNextDir);
    const resolved = path.resolve(process.cwd(), currentTarget);
    if (resolved === cacheRoot) {
      process.exit(0);
    }
    fs.unlinkSync(projectNextDir);
  } else {
    fs.rmSync(projectNextDir, { recursive: true, force: true });
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

fs.symlinkSync(cacheRoot, projectNextDir, 'dir');
console.log(`Linked .next -> ${cacheRoot}`);
