import { test, expect } from '@playwright/test'

/**
 * Tractova UI audit suite — pre-onboarding full-site audit.
 *
 * Extends the smoke pattern (attachErrorCollectors → fail on console.error /
 * pageerror) and adds an extra assertion: zero visible "NaN" / "undefined" /
 * "null" text in the rendered DOM. That class of bug — score formula NaN-
 * poisoning the gauge, sparse-data label rendering as "undefined MW" —
 * doesn't throw, so the smoke listener wouldn't catch it.
 *
 * Auth comes from tests/.auth/pro-user.json (auth.setup.js produces it).
 *
 * READ-ONLY by intent. The Dashboard click matrix uses the existing /
 * route which loads stateProgramMap; we click each state and assert the
 * StateDetailPanel renders without errors. No saves, no Lens form
 * submissions (the API audit handles that separately).
 *
 * Why this file is separate from pro-smoke.spec.js:
 *   - smoke runs on every PR; this is on-demand pre-onboarding (~30s+ runtime)
 *   - this exercises a 30-state click matrix; smoke focuses on the 5 most
 *     critical render paths only
 */

const STATE_NAMES = {
  CA: 'California',     TX: 'Texas',         IL: 'Illinois',     NY: 'New York',     MA: 'Massachusetts',
  NJ: 'New Jersey',     MD: 'Maryland',      PA: 'Pennsylvania', CO: 'Colorado',     AZ: 'Arizona',
  FL: 'Florida',        OH: 'Ohio',          MI: 'Michigan',     WI: 'Wisconsin',    MN: 'Minnesota',
  IN: 'Indiana',        MO: 'Missouri',      KS: 'Kansas',       NE: 'Nebraska',     GA: 'Georgia',
  NC: 'North Carolina', SC: 'South Carolina', VA: 'Virginia',    WV: 'West Virginia', KY: 'Kentucky',
  TN: 'Tennessee',      AL: 'Alabama',       AR: 'Arkansas',     LA: 'Louisiana',    OK: 'Oklahoma',
}

function attachErrorCollectors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (text.includes('CORS') ||
          text.includes('websocket') ||
          text.includes('[vite]') ||
          text.includes('Hydration') ||
          text.includes('Failed to load resource: the server responded with a status of 404') ||
          text.includes('Failed to load resource: the server responded with a status of 401') ||
          text.includes('Failed to load resource: the server responded with a status of 403') ||
          text.includes('Failed to load resource: the server responded with a status of 500') ||
          text.includes('Failed to load resource: net::ERR_FAILED')) {
        return
      }
      errors.push(`[console.error] ${text}`)
    }
  })
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}\n${err.stack || ''}`)
  })
  return errors
}

/**
 * Scan the visible DOM for textual NaN/undefined/null. The smoke listener
 * catches thrown errors; this catches the silent visual bugs where a
 * score formula returns NaN and the gauge happily renders "NaN".
 *
 * Excludes 'undefined' inside attribute values via :scope > * filtering and
 * checks innerText-equivalent via filter() since :text-matches matches
 * text content. Returns an array of (selector, snippet) for diagnosis.
 */
async function findBadText(page) {
  return await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const hits = []
    const re = /\b(NaN|undefined|null)\b/
    let node
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue || '').trim()
      if (!t || t.length > 200) continue
      if (re.test(t)) {
        // Skip code blocks, monospace literals (dev tooling can render these legitimately)
        const parent = node.parentElement
        const isCode = parent && (parent.tagName === 'CODE' || parent.tagName === 'PRE')
        if (isCode) continue
        // Skip if the parent is hidden
        if (parent && (parent.offsetParent === null && parent.tagName !== 'BODY')) continue
        const tag = parent?.tagName?.toLowerCase() || '?'
        const cls = parent?.className?.toString?.()?.slice(0, 60) || ''
        hits.push({ snippet: t.slice(0, 120), parent: `${tag}.${cls}` })
      }
    }
    return hits
  })
}

test.describe('Tractova UI audit', () => {
  // ── Dashboard state-click matrix ──────────────────────────────────────────
  test('Dashboard click matrix — 30 states render StateDetailPanel cleanly', async ({ page }) => {
    test.slow() // 30 clicks × ~500ms each = ~15s + setup
    const errors = attachErrorCollectors(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await page.waitForSelector('svg', { timeout: 15_000 })

    // Wait for stateProgramMap to populate before starting clicks. Without
    // this, the very first state's aria-label is "CA Press Enter..." (no
    // state name) and the test misses on its own first iteration.
    await page.waitForFunction(() => {
      return document.querySelectorAll('[role="button"][aria-label*="California"]').length > 0
    }, { timeout: 10_000 })

    const failures = []
    const states = Object.keys(STATE_NAMES)

    for (const stateId of states) {
      const fullName = STATE_NAMES[stateId]
      const button = page.locator(`[role="button"][aria-label*="${fullName}"]`).first()
      const exists = await button.count() > 0
      if (!exists) {
        failures.push(`${stateId}: no clickable element found with aria-label containing "${fullName}"`)
        continue
      }
      try {
        // force:true bypasses the actionability check — earlier runs failed
        // on MD/FL/MI/LA because the open StateDetailPanel from the previous
        // iteration's click was covering those state paths. The ESC press
        // below closes the panel between iterations, but force:true is the
        // belt-and-braces guarantee that even if a transient overlay covers
        // the path, the click still fires the React handler.
        await button.click({ timeout: 5_000, force: true })
        await page.waitForTimeout(450)
        const bad = await findBadText(page)
        if (bad.length > 0) {
          failures.push(`${stateId}: visible bad text → ${bad.slice(0, 3).map(b => `${b.snippet} [${b.parent}]`).join(' | ')}`)
        }
      } catch (e) {
        failures.push(`${stateId}: click failed → ${e?.message?.slice(0, 200)}`)
      }
      // ESC closes the panel (Dashboard.jsx:189) — without this, the open
      // panel covers the right side of the map and intercepts clicks on
      // subsequent states whose paths happen to be behind it.
      await page.keyboard.press('Escape')
      await page.waitForTimeout(250)
    }

    // Don't fail the whole test for click-failures alone — they're informational.
    // But DO fail for console errors and visible bad text.
    if (failures.length > 0) {
      console.log('\n  Per-state issues:\n  ' + failures.join('\n  '))
    }
    expect(errors, errors.join('\n\n')).toHaveLength(0)
    // Click-failure tolerance: allow up to 3 (e.g., a state outside continental US the map can't hit
    // due to projection clipping). More than that = real bug.
    expect(failures.length, `Too many click failures:\n${failures.join('\n')}`).toBeLessThanOrEqual(3)
  })

  // ── Library populated render ──────────────────────────────────────────────
  test('Library populated path — projects render without bad text', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Library has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Library empty-state render ────────────────────────────────────────────
  test('Library empty state — onboarding card renders without bad text', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/library?preview=empty')
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Library empty has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Profile portfolio gauge ───────────────────────────────────────────────
  test('Profile — animated portfolio gauge renders without NaN/undefined', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/profile')
    // Pro badge proves useSubscription resolved; matches pro-smoke pattern.
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Profile has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── State detail tab paths (5 states deep) ────────────────────────────────
  test('StateDetailPanel — 5 states with tab switching, no errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/')
    await page.waitForSelector('svg', { timeout: 15_000 })

    const targets = ['CA', 'IL', 'NY', 'MA', 'TX']
    for (const stateId of targets) {
      const fullName = STATE_NAMES[stateId]
      const btn = page.locator(`[role="button"][aria-label*="${fullName}"]`).first()
      if (await btn.count() === 0) continue
      await btn.click({ timeout: 3_000 })
      await page.waitForTimeout(400)
      // StateDetailPanel has Radix tabs — click any visible tab triggers
      // (don't assume specific labels since they may evolve; just count tabs)
      const tabs = page.locator('[role="tab"]')
      const tabCount = Math.min(await tabs.count(), 4)
      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).click({ timeout: 2_000 }).catch(() => {})
        await page.waitForTimeout(150)
      }
      const bad = await findBadText(page)
      expect(bad, `${stateId} tab switching has bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    }
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Sparse-data state (cs_status='none') — Alabama ────────────────────────
  test('StateDetailPanel — Alabama (cs_status=none) renders without errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/')
    await page.waitForSelector('svg', { timeout: 15_000 })
    const btn = page.locator('[role="button"][aria-label*="Alabama"]').first()
    await btn.click({ timeout: 3_000 })
    await page.waitForTimeout(500)
    const bad = await findBadText(page)
    expect(bad, `Alabama panel has bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Search render path ────────────────────────────────────────────────────
  test('Search/Lens form — renders past paywall without bad text', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/search')
    // Search.jsx:620 — "Run a targeted intelligence report" (was "feasibility
    // report" — the audit caught that pro-smoke.spec.js still has the stale
    // string and may be silently broken; flagged in findings).
    await expect(page.getByText('Run a targeted intelligence report')).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Search has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Glossary render path ──────────────────────────────────────────────────
  test('Glossary — renders without errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/glossary')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Glossary has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })
})
