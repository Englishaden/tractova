import { defineConfig, devices } from '@playwright/test'

/**
 * Tractova smoke-test config.
 *
 * Goal: catch the class of bugs that built cleanly but crashed at runtime
 * (white screen on state click, Census refresh hangs, etc.) before they
 * ever reach Vercel. One Chromium browser, headless, fast.
 *
 * Run:
 *   npm run test:smoke           -- full suite (unauth + Pro)
 *   npm run test:smoke -- --ui   -- interactive debugger
 *
 * Three projects:
 *   1. `setup`        — runs auth.setup.js once, signs in, saves the Supabase
 *                       session to tests/.auth/pro-user.json
 *   2. `chromium`     — unauthenticated suite (smoke.spec.js); covers Landing,
 *                       /preview, /signin, /memo paywall path, etc.
 *   3. `pro-chromium` — authenticated suite (pro-smoke.spec.js); reuses the
 *                       saved session so Search/Library/Profile load past
 *                       their paywalls. Catches runtime bugs on the entire
 *                       Pro surface — the white-screen class.
 *
 * The Pro suite requires TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local
 * (see .env.example). If those env vars aren't set, the setup project fails
 * with a clear error and the Pro suite is skipped.
 */
export default defineConfig({
  testDir: './tests',
  // Smoke suite -- expect to finish in <30s total.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Setup — one-shot sign-in that produces tests/.auth/pro-user.json.
    {
      name: 'setup',
      testMatch: '**/auth.setup.js',
    },
    // 2. Unauthenticated smoke — runs without any session. Glob is exact
    // filename so it doesn't accidentally pick up pro-smoke.spec.js.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/smoke.spec.js',
    },
    // 3. Authenticated smoke — depends on setup; loads the saved session.
    {
      name: 'pro-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/pro-user.json',
      },
      testMatch: '**/pro-smoke.spec.js',
      dependencies: ['setup'],
    },
    // 4. Mobile responsiveness audit — public routes at iPhone SE viewport.
    // Uses Chromium with a 375x667 viewport (rather than WebKit-via-iPhone-SE
    // device profile, which would require a separate browser install). The
    // engine doesn't matter for overflow detection; the viewport size does.
    // Run separately via `npm run test:mobile`.
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: '**/mobile.spec.js',
    },
    // 5. Mobile audit — authenticated Pro routes. Reuses the saved session
    // from `setup` so Search/Library/Profile/Admin render past their
    // paywalls. Where the dense Lens form + project grid live.
    {
      name: 'mobile-pro',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        storageState: 'tests/.auth/pro-user.json',
      },
      testMatch: '**/mobile-pro.spec.js',
      dependencies: ['setup'],
    },
  ],

  // Auto-boot the Vite dev server before running tests; tear it down after.
  // Reuses an existing server if one is already running on :5173 (typical
  // when the developer is iterating locally).
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
