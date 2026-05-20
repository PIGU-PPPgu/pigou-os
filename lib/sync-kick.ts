import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const LOCK_TTL_MS = 10 * 60 * 1000;

function opsDir() {
  return path.join(process.cwd(), 'content', 'ops');
}

function lockPath() {
  return path.join(opsDir(), 'sync-kick.lock');
}

function isStaleLock(file: string) {
  try {
    const stat = fs.statSync(file);
    return Date.now() - stat.mtimeMs > LOCK_TTL_MS;
  } catch {
    return true;
  }
}

export function kickSyncJobProcessor(limit = 3) {
  fs.mkdirSync(opsDir(), { recursive: true });
  const file = lockPath();
  if (fs.existsSync(file)) {
    if (!isStaleLock(file)) return { started: false, reason: 'processor already running' };
    fs.rmSync(file, { force: true });
  }

  fs.writeFileSync(file, `${new Date().toISOString()}\n`, 'utf8');
  const safeLimit = Math.max(1, Math.min(20, Math.round(limit)));
  const child = spawn('sh', ['-lc', `node scripts/process-sync-jobs.mjs --limit=${safeLimit}; rm -f "${file.replace(/"/g, '\\"')}"`], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return { started: true, pid: child.pid, limit: safeLimit };
}
