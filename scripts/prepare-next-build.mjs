import fs from 'node:fs';
import path from 'node:path';

const projectNextDir = path.join(process.cwd(), '.next');

try {
  const stat = fs.lstatSync(projectNextDir);
  if (stat.isSymbolicLink()) fs.unlinkSync(projectNextDir);
  else fs.rmSync(projectNextDir, { recursive: true, force: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

fs.mkdirSync(projectNextDir, { recursive: true });
