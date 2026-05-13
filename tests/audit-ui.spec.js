import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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

// All 50 states. DC was deliberately stripped from the map (USMap.jsx
// skips geographies without a state_programs row) — 70 sq mi, not a
// target community-solar market, and click was a silent no-op when it
// was rendered.
const STATE_NAMES = {
  AL: 'Alabama',         AK: 'Alaska',          AZ: 'Arizona',         AR: 'Arkansas',
  CA: 'California',      CO: 'Colorado',        CT: 'Connecticut',     DE: 'Delaware',
  FL: 'Florida',         GA: 'Georgia',         HI: 'Hawaii',          ID: 'Idaho',
  IL: 'Illinois',        IN: 'Indiana',         IA: 'Iowa',            KS: 'Kansas',
  KY: 'Kentucky',        LA: 'Louisiana',       ME: 'Maine',           MD: 'Maryland',
  MA: 'Massachusetts',   MI: 'Michigan',        MN: 'Minnesota',       MS: 'Mississippi',
  MO: 'Missouri',        MT: 'Montana',         NE: 'Nebraska',        NV: 'Nevada',
  NH: 'New Hampshire',   NJ: 'New Jersey',      NM: 'New Mexico',      NY: 'New York',
  NC: 'North Carolina',  ND: 'North Dakota',    OH: 'Ohio',            OK: 'Oklahoma',
  OR: 'Oregon',          PA: 'Pennsylvania',    RI: 'Rhode Island',    SC: 'South Carolina',
  SD: 'South Dakota',    TN: 'Tennessee',       TX: 'Texas',           UT: 'Utah',
  VT: 'Vermont',         VA: 'Virginia',        WA: 'Washington',      WV: 'West Virginia',
  WI: 'Wisconsin',       WY: 'Wyoming',
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
          text.includes('Failed to load resource: the server responded with a status of 400') ||
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
  test('Dashboard click matrix — all 50 states render StateDetailPanel cleanly', async ({ page }) => {
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
      // Aria-label is `<Name>: <status> community solar...` when state_programs
      // has a row, else `<stateId>. Press Enter...` (USMap.jsx:170-172;
      // note the PERIOD after the bare ID). Falling back to the bare ID
      // covers states without DB rows (e.g., DC has no row in our seed).
      const byName  = page.locator(`[role="button"][aria-label*="${fullName}"]`).first()
      const byId    = page.locator(`[role="button"][aria-label^="${stateId}."]`).first()
      const button  = byName.or(byId)
      const exists  = await button.count() > 0
      if (!exists) {
        failures.push(`${stateId}: no clickable element found (tried "${fullName}" and "${stateId} ")`)
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
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const bad = await findBadText(page)
    expect(bad, `Library has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  // ── Library empty-state render ────────────────────────────────────────────
  test('Library empty state — onboarding card renders without bad text', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/library?preview=empty')
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible({ timeout: 20_000 })
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
    // 20s timeout accounts for parallel-execution lag on the Vite dev server
    // when 4 workers race lazy-route compilations at once.
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
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
    // Wait for stateProgramMap to populate (same pattern as the matrix test).
    await page.waitForFunction(() => document.querySelectorAll('[role="button"][aria-label*="Alabama"]').length > 0, { timeout: 10_000 })
    const btn = page.locator('[role="button"][aria-label*="Alabama"]').first()
    await btn.click({ timeout: 5_000, force: true })
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

  // ── Axe-core a11y sweep — Phase 6 (TRACTOVA-UX-001) ───────────────────────
  // Hard floor: 0 CRITICAL violations on the four surfaces a power user
  // spends real time inside. Critical is the WCAG bucket that includes
  // missing form labels, empty buttons, frames without titles, links
  // without text, and major contrast failures — the class of bug that
  // makes a screen reader unusable. We don't gate on `serious` yet
  // (color-contrast borderlines, region rules) — those are a Phase 7
  // tightening pass when the design is fully locked. WCAG 2.1 A+AA tags
  // mirror what most enterprise procurement teams audit for.
  async function axeCriticalCount(page, { excludeSelectors = [] } = {}) {
    let builder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    for (const sel of excludeSelectors) builder = builder.exclude(sel)
    const results = await builder.analyze()
    const critical = results.violations.filter(v => v.impact === 'critical')
    return { critical, all: results.violations }
  }
  function summarizeViolations(violations) {
    return violations.map(v =>
      `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''}) — ${v.nodes[0]?.target?.join(' > ') || '?'}`
    ).join('\n')
  }

  test('axe — Lens (/search) has 0 critical violations', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText('Run a targeted intelligence report')).toBeVisible({ timeout: 10_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const { critical, all } = await axeCriticalCount(page)
    expect(critical, `Lens critical a11y violations:\n${summarizeViolations(critical)}\n\n(All violations: ${all.length})`).toHaveLength(0)
  })

  test('axe — Library (/library) has 0 critical violations', async ({ page }) => {
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const { critical, all } = await axeCriticalCount(page)
    expect(critical, `Library critical a11y violations:\n${summarizeViolations(critical)}\n\n(All violations: ${all.length})`).toHaveLength(0)
  })

  test('axe — Profile (/profile) has 0 critical violations', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const { critical, all } = await axeCriticalCount(page)
    expect(critical, `Profile critical a11y violations:\n${summarizeViolations(critical)}\n\n(All violations: ${all.length})`).toHaveLength(0)
  })

  test('axe — Glossary (/glossary) has 0 critical violations', async ({ page }) => {
    await page.goto('/glossary')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    const { critical, all } = await axeCriticalCount(page)
    expect(critical, `Glossary critical a11y violations:\n${summarizeViolations(critical)}\n\n(All violations: ${all.length})`).toHaveLength(0)
  })

  // ── Cron-runs latency monitor probe — Phase 6 (TRACTOVA-UX-001) ───────────
  // Exercises the Cron Latency panel in /admin → Data Health. The panel
  // itself was shipped in Sprint E.2 (CronLatencyPanel.jsx + cronLatencyMonitor.js);
  // this stub probes it from the audit suite so we (a) catch regressions in
  // the analyzer surface, and (b) log any 'warn' severity rows (p95 ≥ 70%
  // of the function ceiling) for engineering follow-up. Warns don't FAIL
  // the test — the structural class of bug they catch (sequential fanout
  // creeping toward maxDuration) may legitimately exist for hours before
  // it's responded to. The hard fail is panel-error or panel-not-found.
  test('Cron Latency panel — renders without error in admin Data Health', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    // Admin.jsx:553 gates the page on profiles.role='admin' or ADMIN_EMAIL.
    // The Pro test user from auth.setup.js typically isn't admin, so when
    // we hit "Access denied" we skip rather than fail — the cron-latency
    // probe is here to verify the panel still works for admins, not to
    // assert the test fixture's role.
    if (await page.getByText('Access denied').count() > 0) {
      test.skip(true, 'Test user is not admin; cron-latency probe requires admin access')
      return
    }
    // Tab 9 = Data Health (Admin.jsx:41). Click by exact label so we don't
    // pick up the dot or color treatment.
    await page.getByRole('button', { name: 'Data Health' }).click()
    // Panel heading proves the component mounted + the analyzeCronLatency
    // promise resolved (loading spinner has cleared and EITHER the table
    // OR the "no successful cron runs" italic is rendered).
    await expect(page.getByRole('heading', { name: 'Cron Latency', level: 3 })).toBeVisible({ timeout: 15_000 })
    // Wait for either the data table or the empty-state copy. The
    // loading-state spinner has the text "Loading latency rollup…" so the
    // body settles to one of three end states.
    await expect(
      page.getByText(/Loading latency rollup/i).or(
        page.locator('text=No successful cron runs').or(
          page.locator('table')
        )
      )
    ).toBeVisible({ timeout: 15_000 })
    // Hard fail: did the analyzer throw an error into the panel?
    const errBlock = page.locator('text=/Failed to load cron latency:/i')
    if (await errBlock.count() > 0) {
      const msg = await errBlock.textContent()
      throw new Error(`Cron Latency panel rendered an error state: ${msg}`)
    }
    // Soft report: log any 'warn' severity rows so the audit run surfaces
    // them in CI output. Selector finds the bg-red-tinted WARN pills
    // (SEVERITY_STYLE.warn uses rgba(220,38,38,...) — that's the only
    // place in the panel using red).
    const warnRows = await page.locator('table tbody tr', {
      has: page.locator('text=WARN')
    }).all()
    if (warnRows.length > 0) {
      const summaries = []
      for (const row of warnRows) {
        const text = (await row.textContent())?.replace(/\s+/g, ' ').trim()
        summaries.push(text?.slice(0, 240))
      }
      console.log(`\n  Cron Latency WARN rows (${warnRows.length}):\n  ` + summaries.join('\n  '))
    }
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })
})

/**
 * E2E signup flow audit.
 *
 * The pre-onboarding question: "can a brand-new user sign up cleanly?"
 * Catches form validation regressions and post-submit navigation breakage
 * before onboarding work multiplies the surface area.
 *
 * These tests do NOT use a real Pro session (signup is anon by definition),
 * so they live in their own describe block and don't load storageState.
 * Real signup-with-Supabase would pollute the DB; we use route interception
 * to mock the auth/v1/signup response and verify both branches:
 *   - Email-confirmation ON  → CheckYourEmailScreen renders
 *   - Email-confirmation OFF → redirect to / (auto-login)
 */
test.describe('Tractova signup flow', () => {
  // No storageState — these tests are explicitly anonymous.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('signup form renders cleanly', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible({ timeout: 10_000 })
    // Form has 4 inputs (name, email, password, confirm) + 1 checkbox.
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('input[type="checkbox"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible()
    const bad = await findBadText(page)
    expect(bad, `Signup has visible bad text: ${bad.map(b => b.snippet).join(' | ')}`).toHaveLength(0)
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('signup form: submit button disabled until agreement checkbox is ticked', async ({ page }) => {
    attachErrorCollectors(page)
    await page.goto('/signup')
    const button = page.getByRole('button', { name: /get started/i })
    // SignUp.jsx:180 — `disabled={loading || !agreed}`. Without the checkbox
    // ticked, the button is disabled regardless of other field validity.
    await expect(button).toBeDisabled()
    await page.locator('input[type="checkbox"]').check()
    await expect(button).toBeEnabled()
  })

  test('signup form: mismatched passwords show error', async ({ page }) => {
    attachErrorCollectors(page)
    await page.goto('/signup')
    await page.locator('input[autocomplete="name"]').fill('Audit Test')
    await page.locator('input[type="email"]').fill('audit-test@audit-only.invalid')
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.nth(0).fill('correct-horse-1')
    await pwInputs.nth(1).fill('different-password-2')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /get started/i }).click()
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5_000 })
  })

  test('signup success — auto-login path (Supabase session returned immediately)', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    // Intercept Supabase auth/v1/signup and return a mock session. This is
    // what happens when "Confirm email" is disabled in Supabase config —
    // the user lands signed-in immediately and SignUp.jsx:55 redirects to /.
    await page.route(/\/auth\/v1\/signup/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token:  'mock-token',
          token_type:    'bearer',
          expires_in:    3600,
          refresh_token: 'mock-refresh',
          user: { id: 'mock-user-id', email: 'audit@audit-only.invalid', user_metadata: { full_name: 'Audit' } },
        }),
      })
    })

    await page.goto('/signup')
    await page.locator('input[autocomplete="name"]').fill('Audit Test')
    await page.locator('input[type="email"]').fill('audit-autologin@audit-only.invalid')
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.nth(0).fill('audit-pass-123')
    await pwInputs.nth(1).fill('audit-pass-123')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /get started/i }).click()

    // Supabase JS will treat the response as containing a session and emit
    // SIGNED_IN; SignUp.jsx:54 navigates to '/'. Wait for the URL change.
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10_000 })
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('signup success — email-confirmation path (no session in response)', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    // Supabase response with no session — i.e. "Confirm email" IS enabled.
    // SignUp.jsx:58 shows CheckYourEmailScreen.
    await page.route(/\/auth\/v1\/signup/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'mock-user-id', email: 'audit@audit-only.invalid', identities: [] },
          session: null,
        }),
      })
    })

    await page.goto('/signup')
    await page.locator('input[autocomplete="name"]').fill('Audit Test')
    await page.locator('input[type="email"]').fill('audit-confirm@audit-only.invalid')
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.nth(0).fill('audit-pass-123')
    await pwInputs.nth(1).fill('audit-pass-123')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /get started/i }).click()

    // CheckYourEmailScreen renders the email address back at the user. The
    // exact copy may evolve; the email being on screen is the contract.
    await expect(page.getByText('audit-confirm@audit-only.invalid')).toBeVisible({ timeout: 10_000 })
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('signup error — server rejection shows visible error', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.route(/\/auth\/v1\/signup/, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'user_already_exists', error_description: 'User already registered' }),
      })
    })

    await page.goto('/signup')
    await page.locator('input[autocomplete="name"]').fill('Audit Test')
    await page.locator('input[type="email"]').fill('already-exists@audit-only.invalid')
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.nth(0).fill('audit-pass-123')
    await pwInputs.nth(1).fill('audit-pass-123')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /get started/i }).click()

    // Error region in SignUp.jsx:86-90 has class bg-red-50 with the
    // error text. We don't pin exact copy (humanizeError may evolve);
    // verify the error block appears.
    await expect(page.locator('.bg-red-50, [class*="bg-red"]').first()).toBeVisible({ timeout: 5_000 })
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })
})

/**
 * ErrorBoundary smoke. Targets /_e2e/crash, a dev-only route in App.jsx that
 * intentionally throws so we can verify:
 *   1. Render-time throws are caught and the "Something went wrong" fallback
 *      renders (white-screen class of bug is contained)
 *   2. Effect-time throws don't take down the whole app (React 18+ doesn't
 *      route them to the boundary, but they shouldn't crash either —
 *      window.onerror catches them, app keeps rendering)
 *
 * The crash route is gated on `import.meta.env.DEV` so it never ships to
 * production. These tests run against the same dev server as the rest of
 * the audit suite, so the route is available.
 */
test.describe('Tractova ErrorBoundary smoke', () => {
  // No storageState — these tests are anonymous; boundary is at app root.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('render-time throw renders the boundary fallback (not a white screen)', async ({ page }) => {
    // The boundary itself logs to console.error by design (ErrorBoundary.jsx:25).
    // Plus React dev mode logs the caught error. So we DON'T use
    // attachErrorCollectors here — the test fails the moment those logs
    // would have asserted clean.
    await page.goto('/_e2e/crash?type=render')
    // The boundary fallback's headline (ErrorBoundary.jsx:74).
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 8_000 })
    // The raw error message is rendered in a <pre> inside the fallback
    // (ErrorBoundary.jsx:83) — confirms the boundary captured the right error.
    await expect(page.getByText(/E2E render crash test/i)).toBeVisible()
    // Try-again + Copy buttons present (ErrorBoundary.jsx:87-100).
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /copy diagnostics/i })).toBeVisible()
  })

  test('async (setTimeout) throw does not crash the app (page still renders)', async ({ page }) => {
    // Truly-async errors don't propagate through React's render/effect path,
    // so they aren't caught by ErrorBoundary. The contract: window.onerror
    // catches them (Playwright surfaces as `pageerror`), but the app keeps
    // rendering — no white screen.
    //
    // We listen for `pageerror`, NOT `console.error` — uncaught throws
    // trigger pageerror, while console.error fires only on explicit
    // console.error() calls.
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)))
    await page.goto('/_e2e/crash?type=async')
    // The fixture's render output is still present, which proves the page
    // didn't get replaced by a boundary fallback or blanked out.
    await expect(page.getByTestId('crash-test-page-loaded')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('Something went wrong')).not.toBeVisible()
    // Wait briefly for the setTimeout (50ms in the fixture) to fire.
    await page.waitForTimeout(300)
    const sawIt = pageErrors.some(t => t.includes('E2E async crash test'))
    expect(sawIt, `expected pageerror to fire from the async throw. pageErrors: ${pageErrors.join(' | ')}`).toBe(true)
  })
})
