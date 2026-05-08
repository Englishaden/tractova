#!/usr/bin/env node
/**
 * One-shot probe — POST a test event directly to Axiom from this machine.
 * Bypasses Vercel entirely so we can isolate whether Axiom-side is set up
 * correctly. If this works, the dataset + token are good and any
 * "no events" issue is Vercel-side (env vars not on Production, or
 * deploy didn't propagate).
 *
 * Usage:
 *   1. Get your AXIOM_TOKEN from Axiom → Settings → API Tokens (you may
 *      need to create a new one if you can't see the existing value).
 *   2. Either:
 *      a) Add to .env.local:
 *           AXIOM_TOKEN=xat-...
 *           AXIOM_DATASET=tractova-logs
 *      b) Or pass as args:
 *           node scripts/probe-axiom.mjs <token> <dataset>
 *   3. Run: node scripts/probe-axiom.mjs
 *   4. Check Axiom → Datasets → tractova-logs → Stream for the
 *      "manual probe" event.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env.local if present
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
} catch { /* ok */ }

const args = process.argv.slice(2)
const TOKEN   = args[0] || process.env.AXIOM_TOKEN
const DATASET = args[1] || process.env.AXIOM_DATASET || 'tractova-logs'

if (!TOKEN) {
  console.error(`
  ! No AXIOM_TOKEN found. Either:
    - Add AXIOM_TOKEN=... to .env.local, or
    - Pass as arg: node scripts/probe-axiom.mjs <token> <dataset>

  Get the token from Axiom → Settings → API Tokens. If you can't see
  the existing value, create a new Ingest token scoped to the
  '${DATASET}' dataset.
`)
  process.exit(1)
}

const url = `https://api.axiom.co/v1/datasets/${DATASET}/ingest`
const event = {
  _time: new Date().toISOString(),
  level: 'info',
  message: 'manual probe from scripts/probe-axiom.mjs',
  service: 'tractova-api',
  source: 'manual-test',
  random: Math.random().toString(36).slice(2, 10),
}

console.log(`\n  POST ${url}`)
console.log(`  token: ${TOKEN.slice(0, 8)}…${TOKEN.slice(-4)} (${TOKEN.length} chars)`)
console.log(`  event: ${JSON.stringify(event, null, 2)}\n`)

const r = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([event]),
})

const text = await r.text()
console.log(`  ← ${r.status} ${r.statusText}`)
console.log(`  Response body: ${text || '(empty)'}\n`)

if (r.ok) {
  console.log(`  ✓ SUCCESS. Check Axiom → Datasets → ${DATASET} → Stream`)
  console.log(`    for the event with random="${event.random}" (within ~30s).\n`)
  console.log(`  If this lands but Vercel-shipped events don't, the issue is`)
  console.log(`  Vercel-side: env vars likely not scoped to Production env, or`)
  console.log(`  the deploy of b752d11 hasn't taken effect.\n`)
  process.exit(0)
} else {
  console.error(`  ✗ FAILED. Common reasons:`)
  console.error(`    - 401: token wrong or expired (regenerate in Axiom)`)
  console.error(`    - 404: dataset name wrong (you typed: '${DATASET}')`)
  console.error(`    - 403: token doesn't have ingest permission for this dataset`)
  console.error(`    - 400: event shape wrong (unlikely — this script uses the standard shape)\n`)
  process.exit(1)
}
