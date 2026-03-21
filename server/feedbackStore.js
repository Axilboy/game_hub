import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.jsonl');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function appendFeedback(entry) {
  await ensureDir();
  const line = JSON.stringify({ ...entry, receivedAt: Date.now() }) + '\n';
  await fs.appendFile(FEEDBACK_FILE, line, 'utf8');
}

export async function readAllFeedback() {
  try {
    const raw = await fs.readFile(FEEDBACK_FILE, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}
