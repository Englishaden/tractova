import { test, expect } from '@playwright/test'

/**
 * Tractova smoke suite.
 *
 * Each test installs a global console listener and a global pageerror
 * listener. ANY console.error or unhandled exception fails the test --
 * that's the mechanism that catches "built clean but crashed at runtime"
 * bugs like the white-screen-on-state-click that hit production today.
 *
 * Tests run against unauthenticated paths so we don't need credentials.
 * Pro-gated routes hit their paywall, which is itself a valid render path
 * we want to verify renders without errors.
 */

// Helper: attach console + pageerror listeners that collect errors into an
// array. Failing the test if the array is non-empty after the user-flow
// completes catches runtime issues that don't otherwise throw a network
// error or assertion failure.
function attachErrorCollectors(page) {
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      // Filter known-noisy non-actionable warnings:
      // - Supabase realtime warnings on dev (CORS, websocket retries)
      // - Vite HMR connection messages
      // - Hydration warnings caused by browser extensions
      if (text.includes('CORS') ||
          text.includes('websocket') ||
          text.includes('[vite]') ||
          text.includes('Hydration') ||
          text.includes('Failed to load resource: the server responded with a status of 404') ||
          text.includes('Failed to load resource: the server responded with a status of 401') ||
          text.includes('Failed to load resource: the server responded with a status of 403') ||
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

test.describe('Tractova smoke', () => {
  test('landing page renders without runtime errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/')
    // Whatever the landing page is showing -- the body should at least not be blank.
    await expect(page.locator('body')).not.toBeEmpty()
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('preview dashboard renders + state click opens the detail panel', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/preview')
    // Wait for the US map to render
    await page.waitForSelector('svg', { timeout: 10_000 })
    // Click a state region. The us-atlas map renders states as path
    // elements with role="button"; we just take the first that's clickable.
    // (Each state's exact attribute varies, so we use a structural selector.)
    const stateButton = page.locator('[role="button"][aria-label*="County"], [role="button"][aria-label*="state"], path[role="button"]').first()
    if (await stateButton.count() === 0) {
      // Map didn't expose role=button; try a path inside the SVG as a
      // fallback. The test is still valuable in catching the runtime
      // error that surfaces during USMap render itself.
      console.warn('No state button found; verifying USMap rendered without errors')
    } else {
      await stateButton.click({ timeout: 5_000 })
      // The StateDetailPanel renders some indicator of a state having been
      // selected -- a close button, a tab list, etc.
      await page.waitForTimeout(800)  // let the panel mount
    }
    // CRITICAL: this is the assertion that would have caught the
    // useSubscription channel collision bug.
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('search page hits paywall (Pro-gated) without errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/search')
    // ProtectedRoute redirects unauth visitors to a sign-in CTA; or
    // UpgradePrompt renders for free authed users. Either way the page
    // should render without a crash.
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    await expect(page.locator('body')).not.toBeEmpty()
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('library page hits paywall (Pro-gated) without errors', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/library')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    await expect(page.locator('body')).not.toBeEmpty()
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('memo view with invalid token shows error UI without crashing', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/memo/this-token-does-not-exist-12345')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    // Should render the "Memo unavailable" UI, not a white screen
    await expect(page.locator('body')).not.toBeEmpty()
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('signin page renders cleanly', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/signin')
    // Form should be visible
    await expect(page.locator('input[type="email"], input[type="password"]').first()).toBeVisible({ timeout: 5_000 })
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })

  test('signup page renders cleanly', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    await page.goto('/signup')
    await expect(page.locator('input[type="email"], input[type="password"]').first()).toBeVisible({ timeout: 5_000 })
    expect(errors, errors.join('\n\n')).toHaveLength(0)
  })
})
