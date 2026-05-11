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

export async function fetchAndExtractUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const resp = await fetch(url, {
      signal:  controller.signal,
      headers: {
        'User-Agent': 'Tractova/1.0 (admin-classifier; +https://tractova.com)',
        'Accept':     'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      redirect: 'follow',
    })
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
