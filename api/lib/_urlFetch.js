/**
 * Shared URL fetcher for the admin AI-classify quick-add paths.
 *
 * Both `policy-classify` and `classify-docket` accept a URL or raw text
 * paste. When the admin pastes a URL, the handler fetches the page
 * server-side, strips HTML to plain text, and passes the body to the
 * AI classifier. Avoids manual copy-paste of article content.
 *
 * Cautious by design: 15s timeout, 200KB raw cap, basic HTML strip, no
 * JS-rendered content. Falls through gracefully on failures — caller
 * uses the original input as literal text if fetch returns null.
 *
 * Originally inline in api/handlers/_lens-policy-classify.js; extracted
 * here so classify-docket can use the same path without duplication.
 */
import dns from 'node:dns/promises'
import net from 'node:net'

const MAX_REDIRECTS = 5

// SSRF guard (audit I1). Reject any address in a private / loopback /
// link-local / reserved range so this server-side fetcher can't be steered at
// internal services or the cloud metadata endpoint (169.254.169.254).
function ipIsBlocked(ip) {
  const kind = net.isIP(ip)
  if (kind === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true        // this-net / 10.0.0.0/8 / loopback
    if (a === 169 && b === 254) return true                  // link-local incl. metadata
    if (a === 172 && b >= 16 && b <= 31) return true         // 172.16.0.0/12
    if (a === 192 && b === 168) return true                  // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true        // CGNAT 100.64.0.0/10
    if (a === 198 && (b === 18 || b === 19)) return true     // 198.18.0.0/15 benchmarking
    if (a >= 224) return true                                // multicast / reserved
    return false
  }
  if (kind === 6) {
    const v = ip.toLowerCase()
    if (v === '::' || v === '::1') return true               // unspecified / loopback
    if (/^fe[89ab]/.test(v)) return true                     // fe80::/10 link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true// fc00::/7 unique-local
    const mapped = v.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/) // IPv4-mapped
    if (mapped) return ipIsBlocked(mapped[1])
    return false
  }
  return true   // not a valid IP literal -> block to be safe
}

// Validate scheme + resolve host, rejecting if ANY resolved address is blocked
// (conservative). Residual: a DNS rebind between this lookup and the fetch
// connect is not fully closed here — acceptable given the path is now
// admin-only and every redirect hop is re-validated.
async function assertPublicUrl(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { throw new Error('invalid_url') }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('blocked_scheme')
  if (net.isIP(u.hostname)) {
    if (ipIsBlocked(u.hostname)) throw new Error('blocked_host')
    return
  }
  let addrs
  try { addrs = await dns.lookup(u.hostname, { all: true }) }
  catch { throw new Error('dns_lookup_failed') }
  if (!addrs.length || addrs.some(a => ipIsBlocked(a.address))) throw new Error('blocked_host')
}

export async function fetchAndExtractUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    // Follow redirects MANUALLY so every hop is re-validated against the SSRF
    // blocklist — `redirect: 'follow'` would let a public URL 302 inward.
    let current = url
    let resp
    for (let hop = 0; ; hop++) {
      await assertPublicUrl(current)            // throws -> caught below
      resp = await fetch(current, {
        signal:  controller.signal,
        headers: {
          'User-Agent': 'Tractova/1.0 (admin-classifier; +https://tractova.com)',
          'Accept':     'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        redirect: 'manual',
      })
      const loc = resp.status >= 300 && resp.status < 400 ? resp.headers.get('location') : null
      if (!loc) break
      if (hop >= MAX_REDIRECTS) {
        clearTimeout(timer)
        return { ok: false, status: resp.status, text: null, error: 'too_many_redirects' }
      }
      current = new URL(loc, current).toString()
    }
    clearTimeout(timer)
    if (!resp.ok) return { ok: false, status: resp.status, text: null }
    // Read up to 200KB raw. Articles are typically 30-60KB. PDFs / huge
    // bill texts won't usefully parse without a PDF lib — out of scope.
    const reader = resp.body?.getReader?.()
    let html = ''
    if (reader) {
      let total = 0
      while (total < 200_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += new TextDecoder().decode(value)
        total += value.length
      }
      reader.cancel().catch(() => {})
    } else {
      html = await resp.text()
    }
    return { ok: true, status: resp.status, text: stripHtml(html).slice(0, 24000) }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, status: null, text: null, error: err?.message || String(err) }
  }
}

// Strip script/style/nav/header/footer/aside/svg, then all remaining tags.
// Decode common entities, collapse whitespace. Conservative — keeps article
// body content without trying to be smart about <article> vs <div>.
export function stripHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  return text.replace(/\s+/g, ' ').trim()
}

// If the input starts with a URL (with or without other text after), fetch
// the URL and use the extracted page text + any trailing text from the user.
// If fetch fails, fall through to treating the original input as literal text.
//
// Returns: { text, fetched, fetchedFrom?, fetchedBytes?, fetchError? }
export async function expandIfUrl(text) {
  const trimmed = (text || '').trim()
  const urlMatch = trimmed.match(/^(https?:\/\/[^\s]+)(?:\s|$)/i)
  if (!urlMatch) return { text: trimmed, fetched: false }
  const url = urlMatch[1]
  const remainder = trimmed.slice(urlMatch[0].length).trim()
  const fetched = await fetchAndExtractUrl(url)
  if (!fetched.ok || !fetched.text || fetched.text.length < 100) {
    return { text: trimmed, fetched: false, fetchError: fetched.error || `HTTP ${fetched.status}` }
  }
  const composed = [
    `Source URL: ${url}`,
    fetched.text,
    remainder && `\nAdmin notes appended:\n${remainder}`,
  ].filter(Boolean).join('\n\n')
  return { text: composed, fetched: true, fetchedFrom: url, fetchedBytes: fetched.text.length }
}
