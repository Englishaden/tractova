import { test, expect } from '@playwright/test'

/**
 * Mobile responsiveness audit — Pro (authenticated) routes.
 *
 * Companion to mobile.spec.js. Uses the saved Pro session (from
 * auth.setup.js) so Search / Library / Profile / Admin render past
 * the paywall — that's where the dense 4,500-LOC Search component
 * and Library project grid live, the most likely places for
 * mobile-breaking layouts.
 *
 * Same horizontal-overflow detection as the public mobile spec; same
 * 375x667 viewport (iPhone SE).
 */

const MOBILE_VIEWPORT = { width: 375, height: 667 }
const OVERFLOW_TOLERANCE_PX = 4

async function checkOverflow(page, routeLabel) {
  await page.setViewportSize(MOBILE_VIEWPORT)
  return await page.evaluate((label) => {
    const docWidth = document.documentElement.scrollWidth
    const viewportWidth = window.innerWidth
    const overflow = docWidth - viewportWidth
    const offenders = []
    function walk(el) {
      if (!el || el.children == null) return
      const rect = el.getBoundingClientRect()
      if (rect.right > viewportWidth + 2) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          id: el.id ? `#${el.id}` : '',
          cls: (el.className || '').toString().slice(0, 60),
          width: Math.round(rect.width),
          right: Math.round(rect.right),
        })
      }
      for (const child of el.children) walk(child)
    }
    walk(document.body)
    offenders.sort((a, b) => b.right - a.right)
    return { route: label, overflow, docWidth, viewportWidth, offenders: offenders.slice(0, 8) }
  }, routeLabel)
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

test.describe('Mobile responsiveness — authed Pro routes', () => {
  const routes = [
    { path: '/search',    label: 'Search (Lens form)' },
    { path: '/library',   label: 'Library (project grid)' },
    { path: '/profile',   label: 'Profile (portfolio stats)' },
    { path: '/admin',     label: 'Admin (Mission Control)' },
  ]

  for (const route of routes) {
    test(`${route.label} (${route.path}) fits 375px viewport`, async ({ page }) => {
      await page.goto(route.path)
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      const result = await checkOverflow(page, route.label)
      expect(
        result.overflow,
        formatOverflowReport(result)
      ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX)
    })
  }
})
