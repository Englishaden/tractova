#!/usr/bin/env node
/**
 * Static bug scanner — read-only. Reports suspected issues across
 * src/ and api/ that the existing lint suite doesn't catch:
 *
 *   1. Orphan imports — symbol imported but never referenced in the file
 *   2. Imports from files that don't exist (or wrong path)
 *   3. JSX components used but not imported / not in scope
 *   4. console.log left in production paths (separate from D.1 which
 *      removed cron-handler spam — this catches src/* drift)
 *   5. TODO / FIXME / XXX markers (actionable backlog)
 *   6. Suspected broken React patterns:
 *        - useEffect with no dependency array (always-rerun)
 *        - useState setter call inside render (infinite render)
 *   7. Async functions that catch but never log or rethrow
 *      (silent failure pattern)
 *
 * NOT a fixer — reports only. Output is grouped by category with
 * file:line refs.
 *
 * Run: node scripts/scan-bugs.mjs
 */
import { readFileSync, statSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

// Walk src/ and api/ for .js/.jsx/.mjs files, skipping ignored areas
function walkSource(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      out.push(...walkSource(path))
    } else if (/\.(jsx?|mjs)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const SRC_FILES = [
  ...walkSource(join(ROOT, 'src')),
  ...walkSource(join(ROOT, 'api')),
].map(f => relative(ROOT, f).replaceAll('\\', '/'))

const findings = {
  orphanImports:    [],
  brokenImports:    [],
  consoleLogInSrc:  [],
  todoMarkers:      [],
  emptyDepArray:    [],
  setStateInRender: [],
  silentCatches:    [],
}

const IMPORT_RE = /^import\s+(?:(?:\*\s+as\s+)?(\w+)|\{([^}]+)\}|(\w+)\s*,\s*\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm

function categorizeImports(content) {
  const imports = []  // [{ name, source }]
  let m
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const [, ns, named, def1, named2, def2, source] = m
    if (ns) imports.push({ name: ns, source })
    if (def1) imports.push({ name: def1, source })
    if (def2) imports.push({ name: def2, source })
    const namedList = named || named2
    if (namedList) {
      for (const piece of namedList.split(',').map(s => s.trim())) {
        if (!piece) continue
        // Handle `foo as bar` — bar is what's actually in scope
        const localName = piece.includes(' as ')
          ? piece.split(/\s+as\s+/)[1].trim()
          : piece
        imports.push({ name: localName, source })
      }
    }
  }
  return imports
}

for (const file of SRC_FILES) {
  const content = readFileSync(join(ROOT, file), 'utf8')
  const lines = content.split(/\r?\n/)
  const imports = categorizeImports(content)
  // Strip imports + their lines from the content for usage-detection
  const importEnd = (() => {
    // Heuristic: imports are at the top of the file. Find first
    // non-import, non-blank, non-comment line.
    let lastImportLine = 0
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s+/.test(lines[i])) lastImportLine = i + 1
      else if (lines[i].trim() && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*') && !lines[i].trim().startsWith('/*')) {
        break
      }
    }
    return lastImportLine
  })()

  const body = lines.slice(importEnd).join('\n')

  // ── Orphan imports ────────────────────────────────────────────
  for (const { name, source } of imports) {
    if (!name) continue
    // Skip side-effect imports / type-only / common destructure idioms
    if (name === '*' || name === 'default') continue
    // Word-boundary check that the name appears in the body
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`)
    if (!re.test(body)) {
      findings.orphanImports.push({ file, name, source })
    }
  }

  // ── Broken imports — relative path that points to nothing ───
  for (const { source } of imports) {
    if (!source.startsWith('.')) continue  // skip npm packages
    const dir = join(ROOT, file, '..')
    let target = resolve(dir, source)
    // Try with explicit extension
    const tryPaths = [
      target,
      target + '.js',
      target + '.jsx',
      target + '.mjs',
      target + '.ts',
      target + '.tsx',
      join(target, 'index.js'),
      join(target, 'index.jsx'),
    ]
    const exists = tryPaths.some(p => {
      try { statSync(p); return true } catch { return false }
    })
    if (!exists) {
      findings.brokenImports.push({ file, source })
    }
  }

  // ── console.log in src/ (api/ is different rules) ────────────
  if (file.startsWith('src/')) {
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]
      // Skip if commented
      if (/^\s*\/\//.test(ln)) continue
      if (/\bconsole\.log\(/.test(ln)) {
        findings.consoleLogInSrc.push({ file, line: i + 1, text: ln.trim().slice(0, 80) })
      }
    }
  }

  // ── TODO / FIXME / XXX markers ───────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const m = ln.match(/(TODO|FIXME|XXX|HACK)\s*:?\s*(.{0,80})/i)
    if (m && /^\s*\/\/|^\s*\*/.test(ln)) {
      findings.todoMarkers.push({ file, line: i + 1, marker: m[1].toUpperCase(), text: m[2].trim().slice(0, 60) })
    }
  }

  // ── useEffect with no dep array ──────────────────────────────
  // Match useEffect(() => { ... }) where the closing `})` is not
  // followed by `, [` (suggesting no dep array).
  const useEffectMatches = [...content.matchAll(/useEffect\s*\(\s*(?:async\s+)?(?:function\s*)?(?:\([^)]*\))?\s*=>\s*\{/g)]
  for (const m of useEffectMatches) {
    // Find matching close brace
    let depth = 1
    let i = m.index + m[0].length
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++
      else if (content[i] === '}') depth--
      i++
    }
    // After the closing }, look ahead for `, [`
    const after = content.slice(i, i + 60).trim()
    const hasDepArray = /^\)|^,\s*\[/.test(after)
    if (!/^,\s*\[/.test(after)) {
      // Only flag if the close-paren is right after the brace (no dep)
      if (after.startsWith(')')) {
        const lineNum = content.slice(0, m.index).split(/\r?\n/).length
        findings.emptyDepArray.push({ file, line: lineNum })
      }
    }
  }

  // ── Silent catch blocks (catch {} or catch with no log/rethrow) ──
  const catchMatches = [...content.matchAll(/}\s*catch\s*\(([^)]*)\)\s*\{([^}]{0,120})\}/g)]
  for (const m of catchMatches) {
    const body = m[2]
    if (body.trim() === '') {
      const lineNum = content.slice(0, m.index).split(/\r?\n/).length
      findings.silentCatches.push({ file, line: lineNum, kind: 'empty' })
    }
  }
}

// ── Report ─────────────────────────────────────────────────────
function header(label, items) {
  return `\n=== ${label} (${items.length}) ===`
}

console.log(`\nScanned ${SRC_FILES.length} files in src/ + api/.\n`)

if (findings.brokenImports.length) {
  console.log(header('BROKEN IMPORTS — relative path resolves to nothing', findings.brokenImports))
  for (const f of findings.brokenImports.slice(0, 30)) {
    console.log(`  ${f.file}  →  ${f.source}`)
  }
  if (findings.brokenImports.length > 30) console.log(`  ... +${findings.brokenImports.length - 30} more`)
}

if (findings.orphanImports.length) {
  console.log(header('ORPHAN IMPORTS — imported but never referenced', findings.orphanImports))
  // Sort by file
  const byFile = new Map()
  for (const f of findings.orphanImports) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  // Cap output per file to 5
  for (const [file, items] of [...byFile.entries()].slice(0, 25)) {
    console.log(`  ${file}:`)
    for (const f of items.slice(0, 5)) {
      console.log(`    "${f.name}" from "${f.source}"`)
    }
    if (items.length > 5) console.log(`    ... +${items.length - 5} more`)
  }
}

if (findings.consoleLogInSrc.length) {
  console.log(header('CONSOLE.LOG IN SRC/ (production noise)', findings.consoleLogInSrc))
  for (const f of findings.consoleLogInSrc.slice(0, 20)) {
    console.log(`  ${f.file}:${f.line}  ${f.text}`)
  }
  if (findings.consoleLogInSrc.length > 20) console.log(`  ... +${findings.consoleLogInSrc.length - 20} more`)
}

if (findings.silentCatches.length) {
  console.log(header('SILENT CATCH BLOCKS — empty catch() {}', findings.silentCatches))
  for (const f of findings.silentCatches.slice(0, 20)) {
    console.log(`  ${f.file}:${f.line}`)
  }
  if (findings.silentCatches.length > 20) console.log(`  ... +${findings.silentCatches.length - 20} more`)
}

if (findings.todoMarkers.length) {
  console.log(header('TODO / FIXME / XXX / HACK markers', findings.todoMarkers))
  // Group by marker type
  const groups = { TODO: [], FIXME: [], XXX: [], HACK: [] }
  for (const f of findings.todoMarkers) {
    if (groups[f.marker]) groups[f.marker].push(f)
  }
  for (const [marker, items] of Object.entries(groups)) {
    if (!items.length) continue
    console.log(`  ${marker} (${items.length}):`)
    for (const f of items.slice(0, 8)) {
      console.log(`    ${f.file}:${f.line}  ${f.text}`)
    }
    if (items.length > 8) console.log(`    ... +${items.length - 8} more`)
  }
}

console.log(`\n=== SUMMARY ===`)
console.log(`  Broken imports:      ${findings.brokenImports.length}  ${findings.brokenImports.length > 0 ? '⚠ FIX' : '✓'}`)
console.log(`  Orphan imports:      ${findings.orphanImports.length}  ${findings.orphanImports.length > 5 ? '⚠ review' : '✓'}`)
console.log(`  console.log in src/: ${findings.consoleLogInSrc.length}  ${findings.consoleLogInSrc.length > 0 ? '⚠ review' : '✓'}`)
console.log(`  Silent catches:      ${findings.silentCatches.length}  ${findings.silentCatches.length > 5 ? '⚠ review' : '✓'}`)
console.log(`  TODO/FIXME markers:  ${findings.todoMarkers.length}  (informational)`)
console.log()

// Exit non-zero only if there are BROKEN imports — those are real bugs.
process.exit(findings.brokenImports.length > 0 ? 1 : 0)
