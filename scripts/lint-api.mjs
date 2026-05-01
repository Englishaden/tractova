/**
 * Syntax-checks all api/*.js serverless function files.
 *
 * Vite build (`npm run build`) only compiles the frontend. Vercel only
 * compiles the API functions on deploy. Locally, a syntax error inside
 * an api/*.js handler ships to prod undetected — and surfaces as HTTP 500
 * for every route on the affected file.
 *
 * Wired into `npm run verify` so it runs before the smoke pass.
 */
import { readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'

let failed = 0
for (const f of readdirSync('api').filter(x => x.endsWith('.js'))) {
  try {
    execSync(`node --check api/${f}`, { stdio: 'pipe' })
  } catch (e) {
    console.error(`✗ api/${f}:\n${e.stderr.toString()}`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) with syntax errors`)
  process.exit(1)
}
console.log('✓ api/*.js syntax OK')
