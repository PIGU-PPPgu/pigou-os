import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectNextDir = path.join(process.cwd(), '.next');
const useExternalCache = Boolean(process.env.PIGOU_NEXT_CACHE_DIR);
const cacheRoot = process.env.PIGOU_NEXT_CACHE_DIR || path.join(os.homedir(), 'Library', 'Caches', 'pigou-os-next');
const resetCache = process.env.PIGOU_RESET_NEXT_CACHE === '1';

function removeDir(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

if (!useExternalCache) {
  try {
    const stat = fs.lstatSync(projectNextDir);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(projectNextDir);
      fs.mkdirSync(projectNextDir, { recursive: true });
    } else if (resetCache) {
      removeDir(projectNextDir);
      fs.mkdirSync(projectNextDir, { recursive: true });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fs.mkdirSync(projectNextDir, { recursive: true });
  }
  console.log('Using project-local .next cache');
  process.exit(0);
}

fs.mkdirSync(cacheRoot, { recursive: true });
if (resetCache) {
  removeDir(path.join(cacheRoot, 'dev'));
}

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
    removeDir(projectNextDir);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

fs.symlinkSync(cacheRoot, projectNextDir, 'dir');
console.log(`Linked .next -> ${cacheRoot}`);
