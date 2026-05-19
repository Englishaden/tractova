#!/usr/bin/env node
// Prints the BUILD_LOG.md pickup section so a fresh Claude Code session is
// oriented without a manual paste. Wired to the SessionStart hook in
// .claude/settings.json — keep that hook and this script in sync.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let lines;
try {
  lines = readFileSync(join(repoRoot, 'BUILD_LOG.md'), 'utf8').split(/\r?\n/);
} catch {
  console.log('No BUILD_LOG.md found — read the repo and ask Aden for direction.');
  process.exit(0);
}

const start = lines.findIndex((l) => l.startsWith('## ') && l.includes('Pickup'));
if (start === -1) {
  console.log('BUILD_LOG.md has no "## ... Pickup" section — read the file directly.');
  process.exit(0);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i += 1) {
  if (lines[i].trim() === '---') {
    end = i;
    break;
  }
}

console.log('=== Tractova session pickup — from BUILD_LOG.md (single source of truth) ===');
console.log(lines.slice(start, end).join('\n').trim());
console.log('=== For full session history, read BUILD_LOG.md. ===');
