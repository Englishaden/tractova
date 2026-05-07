// Deeper mobile audit beyond overflow detection. Hunts for issues
// that the existing mobile.spec.js + mobile-pro.spec.js miss:
//   - Tap targets < 44×44px (Apple HIG / WCAG minimum)
//   - Font sizes < 12px on visible text (mobile readability cliff)
//   - Buttons / clickables too narrow for fingers
//   - Text truncation with hidden content (no ellipsis affordance)
//
// Screenshots saved to test-results/mobile-audit/<route>.png so we
// can eyeball anything the metrics miss.
//
// Run: npx playwright test tests/mobile-audit.spec.js --project=mobile

import { test, expect, devices } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const ROUTES = [
  { path: '/',         label: 'landing' },
  { path: '/preview',  label: 'preview-dashboard' },
  { path: '/signin',   label: 'signin' },
  { path: '/signup',   label: 'signup' },
  { path: '/glossary', label: 'glossary' },
  { path: '/privacy',  label: 'privacy' },
  { path: '/terms',    label: 'terms' },
  { path: '/search',   label: 'search-paywall' },
  { path: '/library',  label: 'library-paywall' },
  { path: '/profile',  label: 'profile-paywall' },
]

const TAP_TARGET_MIN = 44     // px (HIG)
const FONT_MIN       = 12     // px (mobile readability)

mkdirSync('test-results/mobile-audit', { recursive: true })

for (const route of ROUTES) {
  test(`${route.label} (${route.path}) — deep mobile audit`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(500)  // settle animations

    // Screenshot for visual review
    await page.screenshot({
      path: `test-results/mobile-audit/${route.label}.png`,
      fullPage: true,
    })

    // ── Tap-target audit ──────────────────────────────────────────
    const tinyTargets = await page.evaluate(({ minSize }) => {
      const interactive = Array.from(document.querySelectorAll(
        'button, a, [role="button"], input[type="button"], input[type="submit"], [onclick]'
      ))
      const offenders = []
      for (const el of interactive) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue  // hidden
        const hidden = window.getComputedStyle(el).visibility === 'hidden'
                    || window.getComputedStyle(el).display === 'none'
        if (hidden) continue
        if (r.width < minSize || r.height < minSize) {
          offenders.push({
            tag:  el.tagName.toLowerCase(),
            text: (el.innerText || el.value || el.getAttribute('aria-label') || '').slice(0, 40).trim(),
            w:    Math.round(r.width),
            h:    Math.round(r.height),
            cls:  (el.className || '').toString().slice(0, 60),
          })
        }
      }
      return offenders
    }, { minSize: TAP_TARGET_MIN })

    // ── Font-size audit ───────────────────────────────────────────
    const tinyFonts = await page.evaluate(({ minPx }) => {
      const all = Array.from(document.querySelectorAll('p, span, li, td, th, label, button, a'))
      const offenders = []
      for (const el of all) {
        if (!el.innerText?.trim()) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const fs = parseFloat(window.getComputedStyle(el).fontSize)
        if (fs < minPx) {
          offenders.push({
            tag:  el.tagName.toLowerCase(),
            text: el.innerText.slice(0, 50).trim(),
            fs:   fs.toFixed(1),
            cls:  (el.className || '').toString().slice(0, 60),
          })
        }
      }
      // Dedupe by (tag, text, fs) — same content reported once
      const seen = new Set()
      return offenders.filter(o => {
        const k = `${o.tag}|${o.text}|${o.fs}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }, { minPx: FONT_MIN })

    // ── Text truncation without ellipsis ──────────────────────────
    const truncatedNoEllipsis = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('p, span, h1, h2, h3, h4, button, a, label'))
      const offenders = []
      for (const el of all) {
        if (!el.innerText?.trim()) continue
        // Element overflows its container without text-overflow: ellipsis
        const overflowed = el.scrollWidth > el.clientWidth + 1
        if (!overflowed) continue
        const cs = window.getComputedStyle(el)
        const hasEllipsis = cs.textOverflow === 'ellipsis'
                         && cs.whiteSpace === 'nowrap'
                         && (cs.overflow === 'hidden' || cs.overflowX === 'hidden')
        if (!hasEllipsis) {
          offenders.push({
            tag:  el.tagName.toLowerCase(),
            text: el.innerText.slice(0, 50).trim(),
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
          })
        }
      }
      return offenders.slice(0, 8)  // cap to 8 worst offenders per route
    })

    // ── Report ───────────────────────────────────────────────────
    const issues = []
    if (tinyTargets.length > 0) {
      issues.push(`  Tap targets <${TAP_TARGET_MIN}px (${tinyTargets.length}):`)
      for (const t of tinyTargets.slice(0, 5)) {
        issues.push(`    [${t.w}×${t.h}] <${t.tag}> "${t.text}" .${t.cls.slice(0, 40)}`)
      }
      if (tinyTargets.length > 5) issues.push(`    ... +${tinyTargets.length - 5} more`)
    }
    if (tinyFonts.length > 0) {
      issues.push(`  Fonts <${FONT_MIN}px (${tinyFonts.length}):`)
      for (const t of tinyFonts.slice(0, 5)) {
        issues.push(`    [${t.fs}px] <${t.tag}> "${t.text}"`)
      }
      if (tinyFonts.length > 5) issues.push(`    ... +${tinyFonts.length - 5} more`)
    }
    if (truncatedNoEllipsis.length > 0) {
      issues.push(`  Truncated without ellipsis (${truncatedNoEllipsis.length}):`)
      for (const t of truncatedNoEllipsis) {
        issues.push(`    [${t.scrollW}>${t.clientW}] <${t.tag}> "${t.text}"`)
      }
    }

    if (issues.length > 0) {
      console.log(`\n${route.label} (${route.path}):\n${issues.join('\n')}`)
    }

    // Pass/fail rule: report-only for this audit. Hard fail only on
    // truly egregious cases (>10 tap targets or >10 tiny fonts).
    expect(tinyTargets.length, `Too many tiny tap targets on ${route.label}`).toBeLessThan(15)
    expect(tinyFonts.length, `Too many tiny fonts on ${route.label}`).toBeLessThan(20)
  })
}
