// One-shot favicon generator.
//
// Renders public/favicon.svg into the full set of formats Google, browser
// tabs, iOS Safari, and PWA contexts actually pick up:
//
//   public/favicon.ico              (16+32+48 multi-res — Google search snippet)
//   public/favicon-32.png           (browser tab)
//   public/favicon-16.png           (small tab fallback)
//   public/apple-touch-icon.png     (180x180 — iOS Safari "Add to Home Screen")
//   public/icon-192.png             (192x192 — Android Chrome / PWA)
//   public/icon-512.png             (512x512 — PWA splash + Google PWA)
//
// Re-run after editing favicon.svg:  node scripts/build-favicons.mjs
//
// Re-render is deterministic: same SVG in → same bytes out.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const PUBLIC = resolve(process.cwd(), 'public')
const SVG_PATH = resolve(PUBLIC, 'favicon.svg')

const svg = readFileSync(SVG_PATH, 'utf8')

function renderPng(size) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  })
  return r.render().asPng()
}

const targets = [
  { name: 'favicon-16.png',        size: 16  },
  { name: 'favicon-32.png',        size: 32  },
  { name: 'favicon-48.png',        size: 48  },
  { name: 'apple-touch-icon.png',  size: 180 },
  { name: 'icon-192.png',          size: 192 },
  { name: 'icon-512.png',          size: 512 },
]

for (const t of targets) {
  const buf = renderPng(t.size)
  writeFileSync(resolve(PUBLIC, t.name), buf)
  console.log(`✓ ${t.name.padEnd(24)} ${t.size}px  ${(buf.length / 1024).toFixed(1)}KB`)
}

// OG / Twitter Card preview (1200x630). Different SVG (wider aspect with
// the wordmark + tagline). When someone pastes tractova.com into Slack /
// iMessage / Twitter / LinkedIn, the unfurl pulls this.
const ogSvg = readFileSync(resolve(PUBLIC, 'og-image.svg'), 'utf8')
const ogResvg = new Resvg(ogSvg, {
  fitTo: { mode: 'width', value: 1200 },
  background: 'rgba(15,26,46,1)',
  font: { loadSystemFonts: true },
})
const ogBuf = ogResvg.render().asPng()
writeFileSync(resolve(PUBLIC, 'og-image.png'), ogBuf)
console.log(`✓ og-image.png            1200x630  ${(ogBuf.length / 1024).toFixed(1)}KB`)

// ICO bundle: Google's search snippet crawler prefers .ico at /favicon.ico,
// and many older social preview scrapers default to it. Bundle 16/32/48 so
// it's a real multi-resolution icon, not a single-size file masquerading
// as ICO.
const icoBuf = await pngToIco([16, 32, 48].map(s => resolve(PUBLIC, `favicon-${s}.png`)))
writeFileSync(resolve(PUBLIC, 'favicon.ico'), icoBuf)
console.log(`✓ favicon.ico             16+32+48  ${(icoBuf.length / 1024).toFixed(1)}KB`)

// We don't need favicon-48.png as a standalone asset — only as a source
// for the .ico bundle. Keep it out of public/ to avoid asset drift.
import { unlinkSync } from 'node:fs'
unlinkSync(resolve(PUBLIC, 'favicon-48.png'))
console.log(`  (favicon-48.png cleaned up — was only a build artifact for the .ico)`)
