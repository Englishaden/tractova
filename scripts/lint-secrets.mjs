#!/usr/bin/env node
// Single-source-of-truth secret pattern scanner. Used by:
//   1. scripts/_git-hooks/pre-commit  (scans staged diff)
//   2. .github/workflows/verify.yml   (scans the full working tree)
// so a contributor who clones fresh + skips `node scripts/install-git-hooks.mjs`
// or who passes `git commit --no-verify` is still caught at merge time.
//
// Usage:
//   node scripts/lint-secrets.mjs                  # scan tracked files
//   node scripts/lint-secrets.mjs --staged         # scan staged diff (pre-commit)
//
// Patterns: Stripe, Supabase service-role, Anthropic, Resend, OpenAI/generic
// sk-*, AWS, JWT-shaped tokens, plus literal env-var lines that should never
// appear with a value (only as documentation / code reference).

import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const STAGED = process.argv.includes('--staged')

// Regex must NOT use the / delimiter since some patterns include /.
// Each entry: [name, pattern]. Pattern is a JS RegExp source string.
const SECRET_PATTERNS = [
  ['stripe-live',     /sk_live_[a-zA-Z0-9]{20,}/],
  ['stripe-test',     /sk_test_[a-zA-Z0-9]{20,}/],
  ['stripe-restrict', /rk_live_[a-zA-Z0-9]{20,}/],
  ['stripe-webhook',  /whsec_[a-zA-Z0-9]{20,}/],
  ['anthropic',       /sk-ant-[a-zA-Z0-9_\-]{20,}/],
  ['openai-generic',  /sk-(?!ant)[a-zA-Z0-9_\-]{20,}/],
  ['resend',          /\bre_[a-zA-Z0-9_]{20,}/],
  ['aws-access',      /\bAKIA[0-9A-Z]{16}\b/],
  ['aws-temp',        /\bASIA[0-9A-Z]{16}\b/],
  ['jwt',             /eyJhbGciOi[A-Za-z0-9_\-]{50,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/],
  // Literal env-var assignment lines (only matters if a real value follows the =)
  ['env-anthropic',   /^ANTHROPIC_API_KEY=[a-zA-Z0-9_\-]{10,}/m],
  ['env-supabase-sr', /^SUPABASE_SERVICE_ROLE_KEY=[a-zA-Z0-9_\-.]{10,}/m],
  ['env-stripe-sec',  /^STRIPE_SECRET_KEY=[a-zA-Z0-9_]{10,}/m],
  ['env-resend',      /^RESEND_API_KEY=[a-zA-Z0-9_]{10,}/m],
  ['env-cron',        /^CRON_SECRET=[a-zA-Z0-9_\-]{10,}/m],
]

// Files / paths that document patterns by design — scanning them
// produces guaranteed false positives.
const META_FILES = new Set([
  'scripts/_git-hooks/pre-commit',
  'scripts/lint-secrets.mjs',
  'scripts/audit-allowlist.json',
  'docs/secrets-manifest.md',
  'docs/SECURITY_ROTATION_LOG.md',
  'CLAUDE.md',
])

// Binary / large-asset extensions to skip
const SKIP_EXT = /\.(lock|log|snap|png|jpg|jpeg|gif|pdf|csv|xlsx|zip|woff2?|ttf|otf|ico)$/i

function shouldSkipPath(p) {
  if (META_FILES.has(p)) return true
  if (SKIP_EXT.test(p)) return true
  if (p.startsWith('node_modules/')) return true
  if (p.startsWith('dist/')) return true
  if (p.startsWith('backups/')) return true
  if (p.startsWith('public/')) return true   // upstream data files
  return false
}

function listFiles() {
  if (STAGED) {
    const out = execSync('git diff --cached --name-only --diff-filter=AM', { cwd: ROOT })
      .toString().trim()
    return out ? out.split(/\r?\n/) : []
  }
  // Full working tree: just the tracked files
  const out = execSync('git ls-files', { cwd: ROOT }).toString().trim()
  return out ? out.split(/\r?\n/) : []
}

function getContent(file) {
  if (STAGED) {
    // Scan only the staged diff (added lines only)
    try {
      const diff = execSync(`git diff --cached --no-color -- "${file}"`, { cwd: ROOT }).toString()
      // Pull added lines (those starting with +, not +++)
      return diff.split(/\r?\n/).filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n')
    } catch { return '' }
  }
  // Full content for the merge-time scan
  const path = resolve(ROOT, file)
  try {
    const st = statSync(path)
    if (!st.isFile() || st.size > 2 * 1024 * 1024) return ''  // skip > 2MB
    return readFileSync(path, 'utf8')
  } catch { return '' }
}

const files = listFiles()
let hits = []

for (const file of files) {
  if (shouldSkipPath(file)) continue
  const content = getContent(file)
  if (!content) continue
  for (const [name, re] of SECRET_PATTERNS) {
    const m = content.match(re)
    if (m) {
      // Find the line number
      const before = content.slice(0, m.index ?? 0)
      const lineNum = before.split('\n').length
      hits.push({ file, pattern: name, line: lineNum, match: m[0].slice(0, 40) + (m[0].length > 40 ? '…' : '') })
    }
  }
}

if (hits.length === 0) {
  console.log(`✓ secret-scan: clean across ${files.length} ${STAGED ? 'staged file(s)' : 'tracked file(s)'}`)
  process.exit(0)
}

console.error(`\n  ! lint-secrets: ${hits.length} possible secret(s) found:`)
for (const h of hits) {
  console.error(`    ${h.file}:${h.line}  [${h.pattern}]  ${h.match}`)
}
console.error(`\n  If these are false positives, add the path to META_FILES in scripts/lint-secrets.mjs.`)
console.error(`  If real, rotate the secret immediately and remove from history.\n`)
process.exit(1)
