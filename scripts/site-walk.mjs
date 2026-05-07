#!/usr/bin/env node
/**
 * Tractova site format-consistency walk-through.
 *
 * Interactive checklist Aden runs while reviewing the live Vercel deploy
 * before the Huly-inspired Landing revamp. Captures pass/needs-fix/skip
 * status per surface, plus free-text notes for anything flagged.
 *
 * Usage:
 *   node scripts/site-walk.mjs
 *
 * Per item:
 *   [p] / [Enter]  — pass (looks fine)
 *   [n]            — needs fix (prompts for a one-line note)
 *   [s]            — skip (not applicable / didn't load)
 *   [b]            — go back to previous item
 *   [q]            — quit + save (run again to resume where you left off)
 *
 * State persists to `.logs/site-walk-YYYY-MM-DD.json` so quit/resume works
 * across multiple sessions same day. Final summary lands at
 * `.logs/site-walk-YYYY-MM-DD-summary.md` — paste into chat when done.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import readline from 'node:readline'

const BASE = 'https://www.tractova.com'
const TODAY = new Date().toISOString().slice(0, 10)
const SAVE_PATH = `.logs/site-walk-${TODAY}.json`
const SUMMARY_PATH = `.logs/site-walk-${TODAY}-summary.md`

const CHECKPOINTS = [
  {
    section: 'Anonymous flow',
    items: [
      {
        id: 'landing',
        title: 'Landing page',
        url: '/',
        look: 'Hero, three pillars, time-saved comparison, who-it\'s-for. About to be Huly-revamped — flag issues that would survive the redesign (typography, copy, color drift).',
      },
      {
        id: 'signin',
        title: 'Sign in',
        url: '/signin',
        look: 'Form clarity, error states, password reset link, autofocus.',
      },
      {
        id: 'signup',
        title: 'Sign up',
        url: '/signup',
        look: 'Form clarity, password rules, autofocus, confirmation messaging.',
      },
      {
        id: 'privacy',
        title: 'Privacy Policy',
        url: '/privacy',
        look: 'Just shipped today. Section spacing, mono-eyebrow consistency, link colors, table rendering on §04 sub-processors.',
      },
      {
        id: 'terms',
        title: 'Terms of Service',
        url: '/terms',
        look: 'Just shipped today. Section spacing, the new BESS rate-freshness bullet in §06.',
      },
    ],
  },
  {
    section: 'Authed daily flow',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        url: '/',
        look: 'IntelligenceBackground floating dots should be visible (just shipped). Map, MetricsBar, NewsFeed, WelcomeCard, Markets-on-the-Move strip.',
      },
      {
        id: 'lens-form',
        title: 'Lens form (empty)',
        url: '/search',
        look: 'Field labels, dropdown styling, run-analysis button. Form panel header.',
      },
      {
        id: 'lens-result',
        title: 'Lens result — Will County, IL, 5MW CS',
        url: '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar',
        look: 'WALK EVERY SECTION: §01 Market Position gauge, §02 Analyst Brief, §03 Scenario Studio (drag a slider, save a scenario, click "▸ Why?" on it), §04 Pillar Diagnostics (Site/IX/Offtake stacked rows). Bottom disclaimer block — click "Data limitations →" link to see modal. Try switching technology to BESS — look for the "◆ Rates as of 2026-04" amber pill in the BESS revenue panel footer.',
      },
      {
        id: 'lens-tour',
        title: 'LensTour onboarding (5-step coachmark)',
        url: '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar&onboarding=1',
        look: 'If you already dismissed the tour on this device, clear localStorage `tractova_lens_tour_completed_at` first. Then run the URL — tour fires after results load. Walk all 5 steps + closing card.',
      },
      {
        id: 'library',
        title: 'Library (with projects)',
        url: '/library',
        look: 'Project cards, WoW state-delta chips, sort/filter row, "Data refreshed [date]" stamp + breathing dot, Scenarios tab toggle.',
      },
      {
        id: 'library-empty',
        title: 'Library empty-state preview',
        url: '/library?preview=empty',
        look: 'Live-markets strip with 4 cards (or skeleton if stateProgramMap loading), 3 value-prop card grid, CTAs ("Open Tractova Lens" + "Markets on the Move").',
      },
      {
        id: 'compare',
        title: 'Compare drawer',
        url: '/preview',
        look: 'Click any state on the map, in the detail panel click "+ Compare". Add 2-3 states. Click the floating tray. AI compare summary loads.',
      },
      {
        id: 'profile',
        title: 'Profile',
        url: '/profile',
        look: 'Animated header with initials avatar + Tractova mark cameo (Profile is the "gold standard" for ambient — verify others now match). Member-since date legibility, Pro/Free badge, Stripe portal link, exit-intent survey trigger.',
      },
      {
        id: 'glossary',
        title: 'Glossary',
        url: '/glossary',
        look: 'Should land at TOP of page (bug fixed today). Pulsing teal dot in hero "Reference" eyebrow. Term cards, search bar, pillar filter chips. Click any term — should scroll into center and pulse.',
      },
    ],
  },
  {
    section: 'Admin',
    items: [
      {
        id: 'admin-data-health',
        title: 'Admin → Data Health',
        url: '/admin?tab=8',
        look: 'Mission Control 3-card KPI grid (NWI gauge / IX freshness pills / Substations cron bar). Below: Curation Drift row (may be hidden if everything is fresh), Refresh status panel, Freshness grid, Last cron runs, IX staleness alert, Cron latency table.',
      },
    ],
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function flatList(checkpoints) {
  const flat = []
  for (const sec of checkpoints) {
    for (const item of sec.items) flat.push({ ...item, section: sec.section })
  }
  return flat
}

async function loadState() {
  if (!existsSync(SAVE_PATH)) return {}
  try { return JSON.parse(await readFile(SAVE_PATH, 'utf8')) } catch { return {} }
}

async function saveState(state) {
  try { await mkdir('.logs', { recursive: true }) } catch {}
  await writeFile(SAVE_PATH, JSON.stringify(state, null, 2))
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
const ask = (q) => new Promise((r) => rl.question(q, r))

// ── Main loop ────────────────────────────────────────────────────────────────
async function main() {
  const ITEMS = flatList(CHECKPOINTS)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Tractova · site format-consistency walk')
  console.log(`  ${ITEMS.length} surfaces · ${CHECKPOINTS.length} sections`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Commands per item:')
  console.log('    [p] / [Enter]   pass — looks good')
  console.log('    [n]             needs fix — prompts you for a one-line note')
  console.log('    [s]             skip — not applicable / didn\'t load')
  console.log('    [b]             back — re-do previous item')
  console.log('    [q]             quit + save — resume next time you run')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const state = await loadState()

  // Resume past completed items if state exists from earlier run today
  let i = 0
  while (i < ITEMS.length && state[ITEMS[i].id] && state[ITEMS[i].id].status) i++
  if (i > 0) console.log(`(resuming at item ${i + 1} of ${ITEMS.length})\n`)

  let lastSection = null
  while (i < ITEMS.length) {
    const item = ITEMS[i]
    if (item.section !== lastSection) {
      console.log(`\n━━ ${item.section.toUpperCase()} ━━`)
      lastSection = item.section
    }
    console.log(`\n[${String(i + 1).padStart(2, '0')}/${ITEMS.length}] ${item.title}`)
    console.log(`  URL:   ${BASE}${item.url}`)
    console.log(`  Look:  ${item.look}`)

    const ans = (await ask('  > ')).trim().toLowerCase()
    if (ans === 'q') {
      await saveState(state)
      console.log('\n  Saved. Run `node scripts/site-walk.mjs` again to resume.')
      rl.close()
      return
    }
    if (ans === 'b' && i > 0) { i--; continue }
    if (ans === 'b' && i === 0) { console.log('  (already at first item)'); continue }
    if (ans === 's') {
      state[item.id] = { status: 'skip', notes: '' }
    } else if (ans === 'n') {
      const note = (await ask('  note: ')).trim()
      state[item.id] = { status: 'fix', notes: note }
    } else if (ans === 'p' || ans === '') {
      state[item.id] = { status: 'pass', notes: '' }
    } else {
      console.log(`  unknown command "${ans}" — try p / n / s / b / q`)
      continue
    }
    await saveState(state)
    i++
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Walk complete · summary')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const fixes = ITEMS.filter((it) => state[it.id]?.status === 'fix')
  const passes = ITEMS.filter((it) => state[it.id]?.status === 'pass').length
  const skips = ITEMS.filter((it) => state[it.id]?.status === 'skip').length

  console.log(`  ✓ pass:        ${passes}`)
  console.log(`  ✗ needs fix:   ${fixes.length}`)
  console.log(`  - skip:        ${skips}`)
  console.log()

  if (fixes.length > 0) {
    console.log('  Items needing fixes:\n')
    for (const it of fixes) {
      console.log(`    • [${it.section}] ${it.title}`)
      console.log(`        ${BASE}${it.url}`)
      console.log(`        ${state[it.id].notes}\n`)
    }
  } else {
    console.log('  Nothing flagged — everything looks good.\n')
  }

  // Markdown summary file (the thing Aden pastes back to chat)
  let md = `# Tractova site walk · ${TODAY}\n\n`
  md += `**${passes} pass · ${fixes.length} needs-fix · ${skips} skip** (${ITEMS.length} surfaces total)\n\n`
  if (fixes.length === 0) {
    md += `_No items flagged. Format is consistent end-to-end._\n`
  } else {
    md += `## Needs fix (${fixes.length})\n\n`
    for (const it of fixes) {
      md += `### ${it.title}\n`
      md += `- **Section:** ${it.section}\n`
      md += `- **URL:** ${BASE}${it.url}\n`
      md += `- **Note:** ${state[it.id].notes}\n\n`
    }
  }
  if (skips > 0) {
    md += `## Skipped (${skips})\n\n`
    for (const it of ITEMS) {
      if (state[it.id]?.status === 'skip') md += `- ${it.title} (${it.section})\n`
    }
    md += `\n`
  }
  md += `## Passed (${passes})\n\n`
  for (const it of ITEMS) {
    if (state[it.id]?.status === 'pass') md += `- ${it.title} — ${it.section}\n`
  }

  try { await mkdir('.logs', { recursive: true }) } catch {}
  await writeFile(SUMMARY_PATH, md)

  console.log(`  Summary file: ${SUMMARY_PATH}`)
  console.log(`  Paste its contents into chat when you're ready to ship the fixes.\n`)

  rl.close()
}

main().catch((err) => {
  console.error(err)
  rl.close()
  process.exit(1)
})
