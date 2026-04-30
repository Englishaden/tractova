import { defineConfig, devices } from '@playwright/test'

/**
 * Tractova smoke-test config.
 *
 * Goal: catch the class of bugs that built cleanly but crashed at runtime
 * (white screen on state click, Census refresh hangs, etc.) before they
 * ever reach Vercel. One Chromium browser, headless, fast.
 *
 * Run:
 *   npm run test:smoke           -- runs the suite against a local dev server
 *   npm run test:smoke -- --ui   -- interactive debugger
 *
 * The suite focuses on UNAUTHENTICATED paths so we don't need to manage
 * test credentials. Pro-gated paths (/search, /library) hit their paywall
 * which is itself a valid render -- we assert the paywall renders without
 * console errors. That's enough to catch most useSubscription / Supabase
 * realtime collisions, which are the runtime bugs that have hurt us.
 */
export default defineConfig({
  testDir: './tests',
  // Smoke suite -- expect to finish in <20s total.
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

  // Single project to keep the suite fast. Add Firefox/WebKit if/when
  // a customer reports a browser-specific bug.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
