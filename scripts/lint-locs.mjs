#!/usr/bin/env node
// CI gate that prevents file-size regressions on the most-edited
// surfaces. Mirrors scripts/audit-check.mjs in shape: a global rule
// + an allowlist of documented exceptions with explicit ceilings.
//
// Behavior:
//   - Pass: every src/pages/*.jsx is ≤ 1,500 LOC AND every top-level
//     api/*.js is ≤ 500 LOC, OR the file is on scripts/locs-allowlist.json
//     with a ceiling that the file is ≤.
//   - Fail (exit 1): a file grows beyond its budget (or its allowlist
//     ceiling). Output names the file + the breach + suggested action.
//
// Subdirs (api/scrapers/, api/prompts/, api/lib/, src/components/,
// src/components/admin/, src/lib/) are NOT budgeted here — they're
// already small post-decomposition and a per-file budget there would
// be noise. If a subdir file grows large, that's a signal to extract
// further; surface manually rather than via this lint.
//
// Run: node scripts/lint-locs.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

// Global budgets — apply to top-level files in each surface.
const SURFACES = [
  { dir: 'src/pages', glob: /\.jsx$/, budget: 1500 },
  { dir: 'api',       glob: /\.js$/,  budget: 500 },
]

const allowlist = JSON.parse(
  readFileSync(resolve(ROOT, 'scripts/locs-allowlist.json'), 'utf8'),
)
// path -> ceiling
const ALLOWLIST = new Map(
  allowlist.exceptions.map(e => [e.path.replaceAll('\\', '/'), e.ceiling]),
)

function listTopLevel(dir, glob) {
  const out = []
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const full = resolve(ROOT, dir, name)
    const st = statSync(full)
    if (st.isFile() && glob.test(name)) {
      out.push(`${dir}/${name}`)
    }
  }
  return out
}

function loc(path) {
  return readFileSync(resolve(ROOT, path), 'utf8').split(/\r?\n/).length
}

let failed = 0
const breaches = []
const allowlistTouched = new Set()

for (const surf of SURFACES) {
  for (const path of listTopLevel(surf.dir, surf.glob)) {
    const lines = loc(path)
    if (ALLOWLIST.has(path)) {
      allowlistTouched.add(path)
      const ceiling = ALLOWLIST.get(path)
      if (lines > ceiling) {
        breaches.push({
          path,
          lines,
          limit: ceiling,
          kind: 'allowlist-ceiling',
          surface: surf.dir,
        })
        failed += 1
      }
    } else {
      if (lines > surf.budget) {
        breaches.push({
          path,
          lines,
          limit: surf.budget,
          kind: 'global-budget',
          surface: surf.dir,
        })
        failed += 1
      }
    }
  }
}

// Detect stale allowlist entries (file no longer exists or is now under budget).
const stale = []
for (const e of allowlist.exceptions) {
  if (!allowlistTouched.has(e.path.replaceAll('\\', '/'))) {
    stale.push(e.path)
  }
}

const totalChecked = SURFACES.reduce(
  (n, s) => n + listTopLevel(s.dir, s.glob).length,
  0,
)

console.log(
  `lint-locs  ·  ${totalChecked} files checked (top-level src/pages/*.jsx + api/*.js)`
  + `  ·  ${ALLOWLIST.size} allowlist entr${ALLOWLIST.size === 1 ? 'y' : 'ies'}`,
)

if (breaches.length > 0) {
  console.error(`\n  ! ${breaches.length} file(s) exceed their LOC budget:`)
  for (const b of breaches) {
    const headroom = b.lines - b.limit
    console.error(`    ${b.path}: ${b.lines} > ${b.limit} (${b.kind}, +${headroom} over)`)
  }
  console.error(
    '\n  Action: either decompose the file (extract panels/handlers/helpers),'
    + '\n  or update scripts/locs-allowlist.json with a new ceiling + decomposition target.\n',
  )
}

if (stale.length > 0) {
  console.warn(`\n  ! ${stale.length} stale allowlist entr${stale.length === 1 ? 'y' : 'ies'} (file missing or below budget — remove the entry):`)
  for (const p of stale) console.warn(`    ${p}`)
}

if (failed > 0) process.exit(1)
console.log('  ✓ all files within their LOC budget')
