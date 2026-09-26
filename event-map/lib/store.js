// Scenario log: a single JSON file under data/. Writes go through a temp file
// + rename so a crash mid-write never leaves a truncated log.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const FILE = process.env.DATA_FILE || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'analyses.json');
const MAX_ROWS = 500;
let rows = null;
let queue = Promise.resolve();

async function load() {
  if (rows) return rows;
  try { rows = JSON.parse(await readFile(FILE, 'utf8')); } catch { rows = []; }
  return rows;
}
function persist() {
  queue = queue.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true });
    const tmp = FILE + '.tmp';
    await writeFile(tmp, JSON.stringify(rows, null, 1));
    await rename(tmp, FILE);
  });
  return queue;
}

export async function list() {
  return [...await load()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function add(doc) {
  await load();
  const row = { ...doc, id: randomUUID() };
  rows.push(row);
  if (rows.length > MAX_ROWS) rows.splice(0, rows.length - MAX_ROWS);
  await persist();
  return row;
}
export async function setOutcome(id, outcome) {
  await load();
  const row = rows.find(r => r.id === id);
  if (!row) return null;
  row.outcome = String(outcome ?? '').slice(0, 8000);
  row.outcomeAt = new Date().toISOString();
  await persist();
  return row;
}
export async function remove(id) {
  await load();
  const i = rows.findIndex(r => r.id === id);
  if (i < 0) return false;
  rows.splice(i, 1);
  await persist();
  return true;
}
