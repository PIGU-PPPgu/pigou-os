import fs from 'node:fs/promises';
import path from 'node:path';
import { createEmbedding, getEmbeddingConfig } from '@/lib/ai-clients';
import type { KnowledgeNote } from '@/lib/data';
import { assertDurableLocalWrites } from '@/lib/storage-guard';

type VectorRecord = {
  slug: string;
  title: string;
  model: string;
  dimensions: number;
  vector: number[];
  embeddedAt: string;
};

function vectorDir() {
  return path.join(process.cwd(), 'data', 'knowledge-vectors');
}

function noteText(note: KnowledgeNote) {
  return [
    note.title,
    note.summary,
    note.keyPoints.join('\n'),
    note.tags.join(', '),
    note.next || ''
  ].filter(Boolean).join('\n\n').slice(0, 6000);
}

function cosine(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

async function readVectors() {
  const dir = vectorDir();
  try {
    const files = await fs.readdir(dir);
    const records = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      return JSON.parse(content) as VectorRecord;
    }));
    return records;
  } catch {
    return [];
  }
}

export async function embedKnowledgeNote(note: KnowledgeNote) {
  assertDurableLocalWrites();
  const vector = await createEmbedding(noteText(note));
  if (!vector) return { embedded: false, similar: [] as { slug: string; title: string; score: number }[] };

  const existing = await readVectors();
  const similar = existing
    .filter(record => record.slug !== note.slug && record.dimensions === vector.length)
    .map(record => ({ slug: record.slug, title: record.title, score: cosine(vector, record.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const config = getEmbeddingConfig();
  const record: VectorRecord = {
    slug: note.slug,
    title: note.title,
    model: config.model,
    dimensions: vector.length,
    vector,
    embeddedAt: new Date().toISOString()
  };

  await fs.mkdir(vectorDir(), { recursive: true });
  await fs.writeFile(path.join(vectorDir(), `${note.slug}.json`), `${JSON.stringify(record)}\n`, 'utf8');
  return { embedded: true, similar };
}
