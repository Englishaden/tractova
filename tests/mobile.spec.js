import { test, expect } from '@playwright/test'

/**
 * Mobile responsiveness audit (option 4 — 2026-05-05).
 *
 * Loads each public route at iPhone SE viewport (375x667) and asserts no
 * horizontal overflow. Horizontal overflow is the single most-objective
 * metric for "this page doesn't fit a phone" — it captures fixed-width
 * layouts, tables that don't reflow, hardcoded grids without breakpoints,
 * and absolute-positioned elements that escape the container.
 *
 * What this DOESN'T catch (out of scope for automated audit):
 *   - Tap-target sizes (need accessibility audit, not viewport check)
 *   - Below-fold critical content
 *   - Text legibility / contrast at small sizes
 *   - Modal / overlay positioning
 *
 * Each route is tested independently. The detailedness of the failure
 * message (how much overflow, which element) is what makes the audit
 * actionable — a generic "page is wider than viewport" wouldn't tell us
 * where to look.
 */

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const OVERFLOW_TOLERANCE_PX = 4  // sub-pixel rounding noise — anything >4px is real

async function checkOverflow(page, routeLabel) {
  await page.setViewportSize(MOBILE_VIEWPORT)
  const result = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth
    const viewportWidth = window.innerWidth
    const overflow = docWidth - viewportWidth

    // Identify the widest leaf elements that contribute to the overflow,
    // so the test failure tells the developer where to look. Walk the DOM
    // and collect any element whose right edge is past the viewport.
    const offenders = []
    function walk(el) {
      if (!el || el.children == null) return
      const rect = el.getBoundingClientRect()
      if (rect.right > viewportWidth + 2) {
        const tag = el.tagName.toLowerCase()
        const cls = (el.className || '').toString().slice(0, 60)
        const id = el.id ? `#${el.id}` : ''
        offenders.push({
          tag, id, cls,
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          children: el.children.length,
        })
      }
      for (const child of el.children) walk(child)
    }
    walk(document.body)
    // Sort by widest offender first; keep top 8 for actionability.
    offenders.sort((a, b) => b.right - a.right)
    return { overflow, docWidth, viewportWidth, offenders: offenders.slice(0, 8) }
  })
  return { ...result, route: routeLabel }
}

function formatOverflowReport(r) {
  const lines = [
    `\n  Route: ${r.route}`,
    `  Overflow: ${r.overflow}px (doc ${r.docWidth}px > viewport ${r.viewportWidth}px)`,
    `  Top offenders:`,
  ]
  for (const o of r.offenders.slice(0, 6)) {
    lines.push(`    <${o.tag}${o.id} class="${o.cls}">  width=${o.width}px  right=${o.right}px`)
  }
  return lines.join('\n')
}

test.describe('Mobile responsiveness (iPhone SE viewport)', () => {
  // Public routes + Pro-paywall routes. The Pro routes render their paywall
  // page when unauthed, which is itself a real surface that needs to be
  // mobile-clean. Auth-gated DEEP routes (e.g. a populated Library list)
  // belong in a future mobile-pro spec if we extend this audit.
  const routes = [
    { path: '/',            label: 'Landing' },
    { path: '/preview',     label: 'Preview Dashboard' },
    { path: '/signin',      label: 'Sign In' },
    { path: '/signup',      label: 'Sign Up' },
    { path: '/privacy',     label: 'Privacy Policy' },
    { path: '/terms',       label: 'Terms of Service' },
    { path: '/glossary',    label: 'Glossary' },
    { path: '/search',      label: 'Search (paywall)' },
    { path: '/library',     label: 'Library (paywall)' },
    { path: '/profile',     label: 'Profile (paywall)' },
  ]

  for (const route of routes) {
    test(`${route.label} (${route.path}) fits 375px viewport`, async ({ page }) => {
      await page.goto(route.path)
      // Allow async-loaded content to settle (AI-generated paragraphs,
      // chart libraries, etc.) before measuring.
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      const result = await checkOverflow(page, route.label)
      expect(
        result.overflow,
        formatOverflowReport(result)
      ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX)
    })
  }
})
