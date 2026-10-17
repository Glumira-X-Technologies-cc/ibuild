// Records every file and URL the builder consulted, with hash + timestamp,
// so the prompt output can show "Sources consulted" like askkosmo.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_FILES = 40;
const MAX_BYTES = 200_000;
const TEXT_EXT = new Set(['.md','.txt','.json','.yml','.yaml','.js','.mjs','.cjs','.ts','.tsx','.jsx','.css','.html','.py','.go','.rs','.toml']);

export class SourceLedger {
  constructor() { this.entries = []; }

  #hash(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12); }

  async readFile(root, rel) {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(path.resolve(root))) throw new Error(`refused: escapes root -> ${rel}`);
    const ext = path.extname(abs).toLowerCase();
    if (!TEXT_EXT.has(ext)) throw new Error(`refused: non-text -> ${rel}`);
    const buf = await fs.readFile(abs);
    const content = buf.slice(0, MAX_BYTES).toString('utf8');
    const entry = { kind: 'file', ref: rel, bytes: buf.length, hash: this.#hash(content), at: new Date().toISOString() };
    this.entries.push(entry);
    if (this.entries.length > MAX_FILES) this.entries.shift();
    return { ...entry, content };
  }

  recordWeb(url, title = '') {
    const entry = { kind: 'web', ref: url, title, at: new Date().toISOString() };
    this.entries.push(entry);
    return entry;
  }

  toBlock() {
    if (!this.entries.length) return '';
    const lines = this.entries.map(e =>
      e.kind === 'file'
        ? `- [file] ${e.ref} (${e.bytes}B, sha:${e.hash})`
        : `- [web]  ${e.title || e.ref} — ${e.ref} @ ${e.at}`
    );
    return `## Sources consulted\n${lines.join('\n')}`;
  }

  toJSON() { return { count: this.entries.length, entries: this.entries }; }
}
