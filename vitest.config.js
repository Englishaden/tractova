import { defineConfig } from 'vitest/config'

// Vitest scope: ONLY tests/unit/. The other tests/*.spec.js files are
// Playwright specs (browser-driven, smoke + mobile). Mixing the two
// runners on the same glob breaks both.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.spec.js'],
    environment: 'node',
    globals: false,
  },
})
