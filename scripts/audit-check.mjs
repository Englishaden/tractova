#!/usr/bin/env node
// CI-friendly dependency audit. Wraps `npm audit --json` with an
// allowlist (scripts/audit-allowlist.json) so documented-accepted
// vulns don't keep CI permanently red while NEW vulns introduced via
// dep updates do fail the build.
//
// Behavior:
//   - Pass: every observed high+ advisory is allowlisted AND no
//     allowlist entry's review_due has passed.
//   - Fail (exit 1): a NEW high/critical advisory is observed that
//     isn't on the allowlist. Output names the GHSA + package +
//     instructions to either upgrade the dep or extend the allowlist.
//   - Fail (exit 1): an allowlist entry's review_due is in the past.
//     This forces quarterly review of accepted-risk decisions.
//
// Run: node scripts/audit-check.mjs
//
// Note: `npm audit --json` exits non-zero when ANY vulns exist (which
// is always for this repo, given the deferred d3/ip-address/xlsx
// chains). We capture stdout regardless of exit code.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = resolve(import.meta.dirname, '..')
const allowlist = JSON.parse(
  readFileSync(resolve(ROOT, 'scripts/audit-allowlist.json'), 'utf8'),
)
const known = new Set(allowlist.advisories.map(a => a.ghsa))
const today = new Date().toISOString().slice(0, 10)

let raw
try {
  raw = execSync('npm audit --json', {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString()
} catch (e) {
  // npm audit exits non-zero when vulns exist; stdout still has the JSON
  raw = (e.stdout || '').toString()
}

let auditJson
try {
  auditJson = JSON.parse(raw)
} catch {
  console.error('  ! audit-check: failed to parse `npm audit --json` output.')
  process.exit(2)
}

const vulns = auditJson.vulnerabilities || {}

// Walk every via entry; only object entries carry the GHSA URL.
const observed = new Map()  // ghsa -> { ghsa, package, severity, title }
for (const [pkg, info] of Object.entries(vulns)) {
  for (const v of info.via || []) {
    if (typeof v !== 'object') continue
    const m = (v.url || '').match(/GHSA-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i)
    if (!m) continue
    const ghsa = m[0]
    if (!observed.has(ghsa)) {
      observed.set(ghsa, {
        ghsa,
        package: v.name || pkg,
        severity: v.severity || info.severity,
        title: v.title || '',
      })
    }
  }
}

// Find: new high+ NOT on allowlist
const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 }
const newCritical = []
for (const m of observed.values()) {
  if (known.has(m.ghsa)) continue
  if ((SEVERITY_RANK[m.severity] || 0) >= SEVERITY_RANK.high) newCritical.push(m)
}

// Find: allowlist entries past review_due
const overdue = allowlist.advisories.filter(a => a.review_due < today)

const totals = auditJson.metadata?.vulnerabilities || {}
const totalsLine = ['critical', 'high', 'moderate', 'low']
  .map(k => `${k}=${totals[k] ?? 0}`)
  .join(' ')

console.log(
  `audit-check  ·  ${observed.size} advisor${observed.size === 1 ? 'y' : 'ies'} observed`
  + `  ·  ${known.size} on allowlist`
  + `  ·  npm audit totals: ${totalsLine}`,
)

let failed = false

if (newCritical.length > 0) {
  console.error(`\n  ! ${newCritical.length} NEW high/critical advisor${newCritical.length === 1 ? 'y' : 'ies'} NOT on allowlist:`)
  for (const m of newCritical) {
    console.error(`    [${m.severity}] ${m.ghsa.padEnd(34)} ${m.package.padEnd(28)} ${m.title}`)
  }
  failed = true
}

if (overdue.length > 0) {
  console.error(`\n  ! ${overdue.length} allowlist entr${overdue.length === 1 ? 'y is' : 'ies are'} overdue for review:`)
  for (const a of overdue) {
    console.error(`    ${a.ghsa.padEnd(34)} ${a.package.padEnd(28)} review_due=${a.review_due} (today=${today})`)
  }
  failed = true
}

if (failed) {
  console.error(
    '\n  Action: either upgrade the affected dep, or extend scripts/audit-allowlist.json'
    + '\n  with a new advisory entry (must include reason + review_due).\n',
  )
  process.exit(1)
}

console.log('  ✓ no new high/critical advisories; allowlist current')
