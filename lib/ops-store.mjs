import fs from 'node:fs';
import path from 'node:path';

export const opsDir = path.join(process.cwd(), 'content', 'ops');

export function ensureOpsDir() {
  fs.mkdirSync(opsDir, { recursive: true });
}

export function writeOpsJson(name, payload) {
  ensureOpsDir();
  const file = path.join(opsDir, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

export function readOpsJson(name) {
  const file = path.join(opsDir, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function appendOpsEvent(event) {
  ensureOpsDir();
  const file = path.join(opsDir, 'events.jsonl');
  const record = {
    createdAt: new Date().toISOString(),
    ...event
  };
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`);
  return record;
}
