#!/usr/bin/env node
// Standalone visual + functional audit script.
//
// Walks a configurable route list at desktop AND mobile viewports using
// Playwright in headless mode (NO visible browser window — important per
// the standing no-browser-popups rule). For each route × viewport it
// captures a full-page PNG screenshot and every console message, then
// writes a human-readable findings.md summary into a timestamped
// `.audit/visual-<YYYYMMDD-HHMMSS>/` directory (already gitignored).
//
// Why this exists separately from tests/audit-ui.spec.js et al.:
//   - Standalone CLI: callable as `npm run audit:visual` without test-
//     runner ceremony.
//   - Remote-URL aware: --url accepts a Vercel preview, prod, or any
//     deployed environment — the existing Playwright projects assume the
//     local webServer at :5173.
//   - Synthesizes findings: existing infra dumps screenshots to
//     test-results/; this writes a Markdown summary that's the human
//     deliverable.
//   - Versioned artifacts: each run gets its own .audit/visual-<ts>/
//     directory so you can diff successive audits.
//
// CLI:
//   node scripts/visual-audit.mjs [options]
//
// Options:
//   --url <base>            Base URL (default: http://localhost:5173)
//   --routes <a,b,c>        Override default route list (comma-separated)
//   --auth                  Load tests/.auth/pro-user.json storage state
//                           (lets you walk authed routes). Requires the
//                           setup project to have run at least once.
//   --desktop-only          Skip the mobile viewport pass
//   --mobile-only           Skip the desktop viewport pass
//   --no-screenshots        Skip screenshot capture (faster, just collect
//                           console messages)
//   --help                  Print this help and exit
//
// Examples:
//   npm run audit:visual
//   npm run audit:visual -- --url https://tractova.com
//   npm run audit:visual -- --url https://tractova-git-claude-... --auth
//   npm run audit:visual -- --routes /,/about,/glossary --desktop-only
//
// Exit code: 0 always (unless the script itself crashes). Findings are
// surfaced through the report; CI gating can read the JSON sidecar.

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

const ROOT = resolve(import.meta.dirname, '..')
const DEFAULT_BASE_URL = 'http://localhost:5173'
const AUTH_STATE_PATH = 'tests/.auth/pro-user.json'

// Default route list — public + preview surfaces (no auth required).
// Add --auth and the AUTH_ROUTES below get walked too.
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/preview',
  '/glossary',
  '/signin',
  '/signup',
  '/privacy',
  '/terms',
]

// Authed routes walked when --auth is passed. Lens form gets a stable
// "result" URL so we exercise the result-page render, not just the empty
// form.
const AUTH_ROUTES = [
  '/search',
  '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar',
  '/library',
  '/profile',
]

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: 'desktop' },
  mobile:  { width:  390, height: 844, label: 'mobile'  },
}

// ─── arg parsing ─────────────────────────────────────────────────────────────
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      url:             { type: 'string'  },
      routes:          { type: 'string'  },
      auth:            { type: 'boolean' },
      'desktop-only':  { type: 'boolean' },
      'mobile-only':   { type: 'boolean' },
      'no-screenshots':{ type: 'boolean' },
      help:            { type: 'boolean' },
    },
    allowPositionals: false,
    strict: true,
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const baseUrl = (values.url ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  const useAuth = !!values.auth
  const skipScreenshots = !!values['no-screenshots']
  const doDesktop = !values['mobile-only']
  const doMobile  = !values['desktop-only']

  let routes
  if (values.routes) {
    routes = values.routes.split(',').map(r => r.trim()).filter(Boolean)
  } else {
    routes = useAuth ? [...PUBLIC_ROUTES, ...AUTH_ROUTES] : [...PUBLIC_ROUTES]
  }

  return { baseUrl, routes, useAuth, doDesktop, doMobile, skipScreenshots }
}

function printHelp() {
  console.log(`visual-audit — headless Playwright walk of the platform

Usage:
  node scripts/visual-audit.mjs [options]
  npm run audit:visual -- [options]

Options:
  --url <base>            Base URL (default: ${DEFAULT_BASE_URL})
  --routes <a,b,c>        Override default route list (comma-separated)
  --auth                  Load ${AUTH_STATE_PATH} storage state
  --desktop-only          Skip mobile viewport pass
  --mobile-only           Skip desktop viewport pass
  --no-screenshots        Skip screenshot capture (collect console only)
  --help                  Print this help

Examples:
  npm run audit:visual
  npm run audit:visual -- --url https://tractova.com
  npm run audit:visual -- --auth
`)
}

// ─── filesystem ──────────────────────────────────────────────────────────────
function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function slugifyRoute(route) {
  // Turn /search?state=IL&county=Will into search-state-il-county-will
  const cleaned = route.replace(/^\//, '').replace(/\?/g, '-').replace(/[/&=,]/g, '-').replace(/%20/g, '-')
  return (cleaned || 'home').toLowerCase().replace(/-+/g, '-').replace(/-$/, '')
}

// ─── per-route walk ──────────────────────────────────────────────────────────
async function walkRoute({ context, baseUrl, route, viewport, outDir, skipScreenshots }) {
  const slug = slugifyRoute(route)
  const fullUrl = baseUrl + route

  const page = await context.newPage()
  await page.setViewportSize({ width: viewport.width, height: viewport.height })

  // Capture console activity. Categorize as error / warning / info so the
  // report can show them separately.
  const messages = { error: [], warning: [], log: [] }
  page.on('console', (msg) => {
    const t = msg.type()
    const text = msg.text()
    if (t === 'error') messages.error.push(text)
    else if (t === 'warning') messages.warning.push(text)
    else messages.log.push(`[${t}] ${text}`)
  })
  // Page-level errors (uncaught exceptions). Distinct from console.error.
  page.on('pageerror', (err) => {
    messages.error.push(`[pageerror] ${err.message}`)
  })
  // Failed resource loads (404s, blocked requests, etc.).
  page.on('requestfailed', (req) => {
    // Filter out the noisy "ERR_ABORTED" navigations Playwright triggers
    // during teardown; only surface real failures.
    const failure = req.failure()?.errorText ?? 'unknown'
    if (failure === 'net::ERR_ABORTED') return
    messages.error.push(`[requestfailed:${failure}] ${req.url()}`)
  })

  const startMs = Date.now()
  let navigated = false
  let title = ''
  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    // Give lazy-loaded chunks + first paint a moment to settle. Don't wait
    // for networkidle on data-driven pages or it hangs forever.
    await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(800)
    title = await page.title().catch(() => '')
    navigated = true
  } catch (err) {
    messages.error.push(`[navigation] ${err.message}`)
  }
  const elapsedMs = Date.now() - startMs

  // Screenshot — saved as fullPage PNG, named by viewport + route slug.
  let screenshotPath = null
  if (navigated && !skipScreenshots) {
    screenshotPath = `screenshots/${viewport.label}-${slug}.png`
    try {
      await page.screenshot({ path: resolve(outDir, screenshotPath), fullPage: true })
    } catch (err) {
      messages.error.push(`[screenshot] ${err.message}`)
      screenshotPath = null
    }
  }

  await page.close().catch(() => {})

  return {
    route,
    viewport: viewport.label,
    title,
    url: fullUrl,
    navigated,
    elapsedMs,
    screenshotPath,
    errors:   messages.error,
    warnings: messages.warning,
  }
}

// ─── report writers ──────────────────────────────────────────────────────────

// Group flat results by route → viewport for the per-route detail section.
function groupResults(results) {
  const byRoute = new Map()
  for (const r of results) {
    if (!byRoute.has(r.route)) byRoute.set(r.route, {})
    byRoute.get(r.route)[r.viewport] = r
  }
  return byRoute
}

// Dedupe console warnings that hammer every route (React Router future-flag
// warnings, Vite HMR notes) — show them once in a separate section.
function partitionNoise(byRoute) {
  const counts = new Map()
  for (const [, viewports] of byRoute) {
    for (const r of Object.values(viewports)) {
      for (const w of r.warnings) {
        counts.set(w, (counts.get(w) ?? 0) + 1)
      }
    }
  }
  const totalChecks = [...byRoute.values()].reduce((acc, vs) => acc + Object.keys(vs).length, 0)
  const globalNoise = new Set()
  for (const [text, n] of counts) {
    if (n >= totalChecks * 0.5) globalNoise.add(text)
  }
  return globalNoise
}

function writeFindingsMd({ outDir, runMeta, results }) {
  const byRoute = groupResults(results)
  const globalNoise = partitionNoise(byRoute)

  const lines = []
  lines.push(`# Visual audit — ${runMeta.timestamp}`)
  lines.push('')
  lines.push(`- **Base URL:** \`${runMeta.baseUrl}\``)
  lines.push(`- **Viewports:** ${runMeta.viewports.join(', ')}`)
  lines.push(`- **Auth:** ${runMeta.useAuth ? 'on' : 'off'}`)
  lines.push(`- **Routes:** ${runMeta.routes.length}`)
  lines.push(`- **Total checks:** ${results.length}`)
  lines.push('')

  // ── Summary table ──
  lines.push('## Summary')
  lines.push('')
  const cols = ['Route', ...runMeta.viewports.map((v) => v[0].toUpperCase() + v.slice(1)), 'Errors', 'Warnings']
  lines.push(`| ${cols.join(' | ')} |`)
  lines.push(`| ${cols.map(() => '---').join(' | ')} |`)
  for (const [route, viewports] of byRoute) {
    const cells = [`\`${route}\``]
    let totErr = 0
    let totWarn = 0
    for (const v of runMeta.viewports) {
      const r = viewports[v]
      if (!r) { cells.push('—'); continue }
      if (!r.navigated) cells.push('FAIL')
      else cells.push(r.errors.length > 0 ? `✗ ${r.errors.length}` : '✓')
      totErr += r.errors.length
      totWarn += r.warnings.filter((w) => !globalNoise.has(w)).length
    }
    cells.push(String(totErr))
    cells.push(String(totWarn))
    lines.push(`| ${cells.join(' | ')} |`)
  }
  lines.push('')

  // ── Aggregated errors ──
  const allErrors = []
  for (const r of results) {
    for (const e of r.errors) allErrors.push({ route: r.route, viewport: r.viewport, error: e })
  }
  if (allErrors.length > 0) {
    lines.push(`## Errors across all routes (${allErrors.length})`)
    lines.push('')
    lines.push('| Route | Viewport | Error |')
    lines.push('| --- | --- | --- |')
    for (const e of allErrors) {
      lines.push(`| \`${e.route}\` | ${e.viewport} | ${escapeMd(e.error)} |`)
    }
    lines.push('')
  } else {
    lines.push('## Errors')
    lines.push('')
    lines.push('No console errors, page errors, or failed resource loads across any route × viewport. ✓')
    lines.push('')
  }

  // ── Global noise (warnings that hit every route) ──
  if (globalNoise.size > 0) {
    lines.push(`## Repeated warnings (suppressed from per-route detail)`)
    lines.push('')
    lines.push('Warnings that appear on ≥50% of routes are listed here once. Usually framework future-flag warnings, Vite HMR notes, or extension noise.')
    lines.push('')
    for (const w of globalNoise) {
      lines.push(`- ${escapeMd(w)}`)
    }
    lines.push('')
  }

  // ── Per-route detail ──
  lines.push('## Per-route detail')
  lines.push('')
  for (const [route, viewports] of byRoute) {
    lines.push(`### \`${route}\``)
    const first = Object.values(viewports)[0]
    if (first?.title) lines.push(`- **Title:** ${first.title}`)
    lines.push('')
    for (const v of runMeta.viewports) {
      const r = viewports[v]
      if (!r) continue
      const status = !r.navigated ? '**FAIL — did not navigate**'
        : r.errors.length > 0 ? `${r.errors.length} error(s)`
        : 'clean ✓'
      const visibleWarns = r.warnings.filter((w) => !globalNoise.has(w))
      lines.push(`**${v}** — ${status} · ${visibleWarns.length} warning(s) · ${r.elapsedMs}ms`)
      if (r.screenshotPath) {
        lines.push('')
        lines.push(`![${v} ${route}](${r.screenshotPath})`)
      }
      if (r.errors.length > 0) {
        lines.push('')
        lines.push('Errors:')
        for (const e of r.errors) lines.push(`- ${escapeMd(e)}`)
      }
      if (visibleWarns.length > 0) {
        lines.push('')
        lines.push('Warnings:')
        for (const w of visibleWarns) lines.push(`- ${escapeMd(w)}`)
      }
      lines.push('')
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(`_Generated by scripts/visual-audit.mjs at ${runMeta.timestamp}._`)
  lines.push('')

  return lines.join('\n')
}

function escapeMd(s) {
  // Pipe chars break table rendering; newlines break list items. Replace
  // both with safe alternatives.
  return String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').slice(0, 240)
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseCliArgs()

  const viewportNames = []
  if (opts.doDesktop) viewportNames.push('desktop')
  if (opts.doMobile)  viewportNames.push('mobile')
  if (viewportNames.length === 0) {
    console.error('No viewports selected — pass --desktop-only or --mobile-only sparingly.')
    process.exit(1)
  }

  const ts = timestamp()
  const outDir = resolve(ROOT, '.audit', `visual-${ts}`)
  await mkdir(resolve(outDir, 'screenshots'), { recursive: true })

  console.log(`▸ Visual audit — ${ts}`)
  console.log(`  base: ${opts.baseUrl}`)
  console.log(`  routes: ${opts.routes.length}, viewports: ${viewportNames.join('+')}, auth: ${opts.useAuth ? 'on' : 'off'}`)
  console.log(`  output: .audit/visual-${ts}/`)
  console.log('')

  // Storage state for auth, if requested + present.
  let storageState
  if (opts.useAuth) {
    const path = resolve(ROOT, AUTH_STATE_PATH)
    if (existsSync(path)) {
      storageState = path
    } else {
      console.warn(`  ⚠ --auth requested but ${AUTH_STATE_PATH} not found.`)
      console.warn(`    Run \`npm run test:smoke:pro\` once to generate it, or omit --auth.`)
      console.warn('')
    }
  }

  // One headless browser, one context per viewport. Pages get torn down
  // per route to keep memory bounded and ensure listener cleanup.
  const browser = await chromium.launch({ headless: true })
  const results = []
  try {
    for (const vname of viewportNames) {
      const viewport = VIEWPORTS[vname]
      const context = await browser.newContext({ storageState })
      let idx = 0
      for (const route of opts.routes) {
        idx++
        const r = await walkRoute({
          context,
          baseUrl: opts.baseUrl,
          route,
          viewport,
          outDir,
          skipScreenshots: opts.skipScreenshots,
        })
        results.push(r)
        const status = !r.navigated ? 'FAIL'
          : r.errors.length > 0 ? `${r.errors.length} err`
          : 'ok'
        console.log(
          `  [${String(idx).padStart(2)}/${opts.routes.length}] ${vname.padEnd(7)} ${route.padEnd(40)} ` +
          `→ ${status.padEnd(6)} ${r.warnings.length}w (${r.elapsedMs}ms)`
        )
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }

  // Write findings.md + results.json sidecar.
  const md = writeFindingsMd({
    outDir,
    runMeta: {
      timestamp: ts,
      baseUrl: opts.baseUrl,
      viewports: viewportNames,
      useAuth: opts.useAuth,
      routes: opts.routes,
    },
    results,
  })
  await writeFile(resolve(outDir, 'findings.md'), md, 'utf8')
  await writeFile(resolve(outDir, 'results.json'), JSON.stringify({ runMeta: { timestamp: ts, baseUrl: opts.baseUrl, viewports: viewportNames, useAuth: opts.useAuth, routes: opts.routes }, results }, null, 2), 'utf8')

  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0)
  console.log('')
  console.log(`▸ Done. ${results.length} checks · ${totalErrors} total errors`)
  console.log(`  Report: .audit/visual-${ts}/findings.md`)
}

main().catch((err) => {
  console.error('Visual audit crashed:', err)
  process.exit(1)
})
