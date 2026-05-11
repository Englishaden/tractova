import { readFileSync } from 'node:fs'
const html = readFileSync('/tmp/article.html', 'utf8')
let text = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim()
console.log('text length:', text.length)
for (const needle of ['2.80', '6/kWAC', '$6 ', 'per kWAC', 'monthly']) {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase())
  if (idx >= 0) {
    console.log(`\n"${needle}" found at ${idx}:`)
    console.log('  ', text.slice(Math.max(0, idx - 80), idx + 180))
  } else {
    console.log(`\n"${needle}" NOT FOUND`)
  }
}
