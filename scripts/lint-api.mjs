/**
 * Syntax-checks every JS file under api/ (recursive).
 *
 * Vite build (`npm run build`) only compiles the frontend. Vercel only
 * compiles the API functions on deploy. Locally, a syntax error inside
 * an api/*.js handler ships to prod undetected — and surfaces as HTTP 500
 * for every route on the affected file.
 *
 * Recurses one level into api/scrapers/, api/lib/, api/prompts/ etc. as
 * the API tree decomposes. Wired into `npm run verify` so it runs before
 * the smoke pass.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

function listJs(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      out.push(...listJs(path))
    } else if (name.endsWith('.js')) {
      out.push(path.replaceAll('\\', '/'))
    }
  }
  return out
}

const files = listJs('api')
let failed = 0
for (const f of files) {
  try {
    execSync(`node --check ${f}`, { stdio: 'pipe' })
  } catch (e) {
    console.error(`✗ ${f}:\n${e.stderr.toString()}`)
    failed += 1
  }
}

if (failed > 0) {
  console.error(`\n${failed} file(s) with syntax errors`)
  process.exit(1)
}
console.log(`✓ api/**/*.js syntax OK (${files.length} files)`)
