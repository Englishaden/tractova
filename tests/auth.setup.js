import { test as setup, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * One-shot sign-in setup.
 *
 * Drives the real /signin form so we exercise the same auth path a user
 * would. After navigation lands away from /signin, Playwright captures
 * localStorage (where supabase-js v2 keeps the session) into
 * tests/.auth/pro-user.json. Authed test projects load that file via
 * `storageState` and start every test already signed in.
 *
 * Credentials live in .env.local as TEST_USER_EMAIL / TEST_USER_PASSWORD.
 * That account must have profiles.subscription_tier='pro' and
 * subscription_status='active' (set via SQL — no Stripe involvement).
 */

const STORAGE_STATE = 'tests/.auth/pro-user.json'

// Tiny .env.local parser — avoids adding dotenv as a devDep just for this.
function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch {
    // No .env.local — env vars must come from the shell instead.
  }
}

loadEnvLocal()

setup('authenticate as Pro user', async ({ page }) => {
  const email    = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in .env.local. ' +
      'See .env.example for setup instructions.'
    )
  }

  await page.goto('/signin')

  // Form is rendered by src/pages/SignIn.jsx — the inputs are the only
  // email/password pair on the page.
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  // Successful sign-in navigates to `from` (default: /). Wait for the
  // URL to change OR for an auth-only element to appear, whichever
  // comes first. If sign-in failed the form's error region renders
  // instead — fail loudly.
  await page.waitForURL((url) => !url.pathname.startsWith('/signin'), {
    timeout: 15_000,
  }).catch(async () => {
    const visibleError = await page.locator('text=/incorrect|invalid|wrong|failed/i').first().isVisible().catch(() => false)
    if (visibleError) {
      throw new Error('Sign-in failed: server reported invalid credentials. Check TEST_USER_EMAIL/PASSWORD.')
    }
    throw new Error('Sign-in did not redirect away from /signin within 15s. Check creds and Supabase availability.')
  })

  // Sanity check: the supabase auth token landed in localStorage.
  // supabase-js v2 keys it as `sb-<project-ref>-auth-token`.
  const hasSession = await page.evaluate(() => {
    return Object.keys(window.localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  })
  expect(hasSession, 'Supabase session token missing from localStorage after sign-in').toBe(true)

  await page.context().storageState({ path: STORAGE_STATE })
})
