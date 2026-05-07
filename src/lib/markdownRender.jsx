// Minimal markdown renderer for deal notes — used by YourDealSection's
// side-by-side preview. Block: # h2 / ## h3 / ### h4, - or * bullets,
// 1. numbered lists, blank line = paragraph break. Inline: **bold**,
// *italic*, `code`, [text](url). Out of scope: tables, blockquotes,
// images, code fences (deferred follow-up).

/**
 * Renders inline markdown (bold/italic/code/links) inside a single
 * line. Returns an array of React nodes that can be placed inside any
 * inline-text container (h-tag, p, li).
 *
 * @param {string} text
 * @returns {Array<string|JSX.Element>}
 */
export function renderMarkdownInline(text) {
  if (!text) return text
  const parts = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const bold = remaining.match(/^\*\*([^*]+?)\*\*/)
    if (bold) { parts.push(<strong key={key++}>{bold[1]}</strong>); remaining = remaining.slice(bold[0].length); continue }
    const italic = remaining.match(/^\*([^*]+?)\*/)
    if (italic) { parts.push(<em key={key++}>{italic[1]}</em>); remaining = remaining.slice(italic[0].length); continue }
    const code = remaining.match(/^`([^`]+?)`/)
    if (code) { parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-gray-100 text-[11px] font-mono">{code[1]}</code>); remaining = remaining.slice(code[0].length); continue }
    const link = remaining.match(/^\[([^\]]+?)\]\(([^)]+?)\)/)
    if (link) { parts.push(<a key={key++} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline hover:text-teal-800">{link[1]}</a>); remaining = remaining.slice(link[0].length); continue }
    parts.push(remaining[0])
    remaining = remaining.slice(1)
  }
  // Coalesce adjacent string fragments so React doesn't render each char as its own node
  const coalesced = []
  let buf = ''
  for (const p of parts) {
    if (typeof p === 'string') buf += p
    else { if (buf) { coalesced.push(buf); buf = '' }; coalesced.push(p) }
  }
  if (buf) coalesced.push(buf)
  return coalesced
}

/**
 * Renders block-level markdown (headings + bullets + numbered lists +
 * paragraphs). Returns a fragment of React elements suitable for
 * dropping into a pre-styled prose container.
 *
 * @param {string} text
 * @returns {JSX.Element|null}
 */
export function renderMarkdown(text) {
  if (!text || !text.trim()) return <p className="text-xs text-gray-400 italic">No notes yet.</p>
  const lines = text.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,3}) (.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = headingMatch[2]
      const cls = level === 1 ? 'text-base font-bold text-ink mt-3 mb-1.5'
                : level === 2 ? 'text-sm font-bold text-ink mt-3 mb-1'
                : 'text-xs font-bold text-ink uppercase tracking-wider mt-2 mb-1'
      out.push(level === 1 ? <h2 key={i} className={cls}>{renderMarkdownInline(content)}</h2>
             : level === 2 ? <h3 key={i} className={cls}>{renderMarkdownInline(content)}</h3>
             : <h4 key={i} className={cls}>{renderMarkdownInline(content)}</h4>)
      i++; continue
    }
    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i++
      }
      out.push(
        <ul key={i} className="list-disc pl-5 my-1 text-xs text-ink space-y-0.5">
          {items.map((it, j) => <li key={j}>{renderMarkdownInline(it)}</li>)}
        </ul>
      )
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      out.push(
        <ol key={i} className="list-decimal pl-5 my-1 text-xs text-ink space-y-0.5">
          {items.map((it, j) => <li key={j}>{renderMarkdownInline(it)}</li>)}
        </ol>
      )
      continue
    }
    if (line.trim() === '') {
      // Collapse multiple blank lines into one spacer
      while (i < lines.length && lines[i].trim() === '') i++
      out.push(<div key={i} className="h-2" />)
      continue
    }
    out.push(<p key={i} className="text-xs text-ink leading-relaxed my-0.5">{renderMarkdownInline(line)}</p>)
    i++
  }
  return out
}
