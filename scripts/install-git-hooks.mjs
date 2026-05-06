#!/usr/bin/env node
// One-shot installer for Tractova git hooks. Copies the template at
// scripts/_git-hooks/* into .git/hooks/ and chmods +x.
//
// Run after a fresh clone: `node scripts/install-git-hooks.mjs`.
//
// .git/hooks/ is local to each clone (not version-controlled), so this
// script bridges the gap — the template lives in the repo, the hook
// lives in the clone.

import { readdirSync, readFileSync, writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
let GIT_DIR
try {
  GIT_DIR = execSync('git rev-parse --git-dir', { cwd: ROOT, encoding: 'utf8' }).trim()
  // `git rev-parse --git-dir` returns a relative path; resolve against ROOT
  GIT_DIR = resolve(ROOT, GIT_DIR)
} catch {
  console.error('  ! Not in a git repository. Aborting hook install.')
  process.exit(1)
}

const HOOKS_DIR = join(GIT_DIR, 'hooks')
const TEMPLATE_DIR = join(ROOT, 'scripts', '_git-hooks')

if (!existsSync(TEMPLATE_DIR)) {
  console.error(`  ! Template directory not found: ${TEMPLATE_DIR}`)
  process.exit(1)
}

if (!existsSync(HOOKS_DIR)) mkdirSync(HOOKS_DIR, { recursive: true })

let installed = 0
for (const entry of readdirSync(TEMPLATE_DIR)) {
  if (entry.startsWith('.') || entry.endsWith('.md')) continue
  const src = join(TEMPLATE_DIR, entry)
  const dst = join(HOOKS_DIR, entry)
  const content = readFileSync(src, 'utf8')
  writeFileSync(dst, content)
  try { chmodSync(dst, 0o755) } catch { /* Windows: chmod is a noop, the hook still runs via bash */ }
  console.log(`  ✓ installed ${entry} → ${dst}`)
  installed += 1
}

if (installed === 0) {
  console.warn(`  ! No hooks found in ${TEMPLATE_DIR}`)
  process.exit(1)
}
console.log(`\n  ${installed} hook(s) installed. Bypass any single hook with --no-verify.`)
