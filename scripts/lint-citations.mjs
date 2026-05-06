#!/usr/bin/env node
// Citation lint — walks committed source/docs for hardcoded numerical
// citations and flags any that aren't traceable to either:
//
//   1. A Supabase migration body (the source of truth for live data)
//   2. The editorial allowlist (scripts/citations.allowlist.json)
//
// This is a heuristic, not a fact-checker. It can't validate that a
// quoted percentile is correct — only that the number was DELIBERATELY
// chosen by being present in a migration or an allowlist entry, rather
// than fabricated mid-render by AI recall.
//
// Output: warns to stderr; exit 0 unless --strict is passed.
// Run: node scripts/lint-citations.mjs [--strict] [--diff-only]
//   --strict      exit non-zero on any unverified citation
//   --diff-only   only check files that differ from origin/main
//                 (intended for pre-commit / PR gating)
//
// Tied to CLAUDE.md Section 3 (HALLUCINATION GUARDS) and Plan B item B.6.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const STRICT = process.argv.includes('--strict')
const DIFF_ONLY = process.argv.includes('--diff-only')

// Patterns flagged. Each matches a citation-shape number a reader
// would treat as "from a source" rather than algorithmic output.
// Designed to be tight — false positives erode the signal value.
const CITATION_PATTERNS = [
  // $1.23/W, $0.05/kWh, $145.50/MWh — capex / energy-price citations.
  // Capped at $999.99 to avoid catching synthesis-output formatting code.
  { name: '$/unit', re: /\$\d{1,3}(?:\.\d+)?\/(W|kWh|MWh|kW-yr|kW-mo|kW-mo|kW-month|MMBTU)/g },
  // n=15, n>=3 — sample-size citations (LBNL / NREL Tracking the Sun).
  // Capped at 999 to skip threshold-check code like `if (n >= 1000000)`.
  { name: 'sample size', re: /\bn\s*[><]?=\s*\d{1,3}\b/g },
  // p10/p25/p50/p75/p90 = $X.YZ — percentile citations.
  { name: 'percentile $', re: /\bp\d{1,2}\s*=\s*\$\d+(?:\.\d+)?/g },
]

// Files to skip entirely (their content is meta/documentation about
// the lint, or pre-existing instrument-data audits the lint shouldn't
// re-flag).
const SKIP_FILES = new Set([
  'scripts/lint-citations.mjs',
  'scripts/lint-citations.mjs'.replace(/\//g, '\\'),
])

// File extensions to scan
const EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.md'])

// Subtrees to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'dist-ssr', 'public',
  'test-results', 'playwright-report', '.claude', 'tests/.auth',
])

const ALLOWLIST_PATH = join(ROOT, 'scripts', 'citations.allowlist.json')
let allowlist = { numbers: [], patterns: [] }
if (existsSync(ALLOWLIST_PATH)) {
  try { allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) }
  catch (e) { console.warn('  ! citations.allowlist.json failed to parse:', e.message) }
}

function listFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const p = join(dir, entry)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) out.push(...listFiles(p))
    else {
      const dot = entry.lastIndexOf('.')
      if (dot >= 0 && EXTENSIONS.has(entry.slice(dot))) out.push(p)
    }
  }
  return out
}

function diffFiles() {
  try {
    const out = execSync('git diff --name-only origin/main', { encoding: 'utf8' })
    return out.split('\n').filter(Boolean).map((p) => join(ROOT, p))
  } catch {
    return []
  }
}

// Build a haystack of numbers seen in migrations + allowlist. We
// don't try to parse SQL — just slurp every migration body as text
// and look for substring matches. Same for the allowlist.
function buildHaystack() {
  const parts = []
  const migrationsDir = join(ROOT, 'supabase', 'migrations')
  if (existsSync(migrationsDir)) {
    for (const f of readdirSync(migrationsDir)) {
      if (!f.endsWith('.sql')) continue
      parts.push(readFileSync(join(migrationsDir, f), 'utf8'))
    }
  }
  for (const n of allowlist.numbers || []) parts.push(String(n))
  for (const p of allowlist.patterns || []) parts.push(p)
  return parts.join('\n')
}

const HAYSTACK = buildHaystack()

function isVerified(citation) {
  // Strip prefix dollar signs and whitespace; we want substring match
  // against the migration text. "n=3" matches if migrations mention n=3
  // anywhere; "$1.45/W" matches if 1.45 appears (loose but useful).
  const num = citation.replace(/[^\d.]/g, '')
  if (!num) return true // no number, nothing to verify
  return HAYSTACK.includes(num)
}

const filesToCheck = DIFF_ONLY ? diffFiles() : listFiles(ROOT)
const findings = []

for (const file of filesToCheck) {
  if (!EXTENSIONS.has(file.slice(file.lastIndexOf('.')))) continue
  const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '')
  if (SKIP_FILES.has(rel)) continue
  let text
  try { text = readFileSync(file, 'utf8') } catch { continue }
  const lines = text.split('\n')
  for (const { name, re } of CITATION_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const citation = m[0]
      if (isVerified(citation)) continue
      // Find line number
      let pos = 0
      let lineNo = 1
      for (const ln of lines) {
        if (pos + ln.length + 1 > m.index) break
        pos += ln.length + 1
        lineNo += 1
      }
      findings.push({ file: file.replace(ROOT + '/', '').replace(ROOT + '\\', ''), line: lineNo, citation, pattern: name })
    }
  }
}

if (findings.length === 0) {
  console.log(`✓ citation lint: 0 unverified citations across ${filesToCheck.length} file(s)`)
  process.exit(0)
}

console.warn(`\n  ⚠ Citation lint: ${findings.length} unverified citation(s)`)
console.warn(`  Reference: CLAUDE.md Section 3 — HALLUCINATION GUARDS`)
console.warn(`  Heuristic: number not present in supabase/migrations/*.sql or scripts/citations.allowlist.json\n`)
const byFile = {}
for (const f of findings) (byFile[f.file] ??= []).push(f)
for (const [file, list] of Object.entries(byFile)) {
  console.warn(`  ${file}`)
  for (const f of list) {
    console.warn(`    line ${f.line}  [${f.pattern}]  ${f.citation}`)
  }
}
console.warn(`\n  To accept a citation, add the number to scripts/citations.allowlist.json:`)
console.warn(`    { "numbers": ["1.45", "0.05"], "patterns": ["LBNL TTS 2024"] }\n`)

process.exit(STRICT ? 1 : 0)
