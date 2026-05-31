import { useMemo, useState } from 'react'

// SortableTable — a tiny headless sortable table (Kibo Table pattern ported to
// plain JSX — no @tanstack/react-table dep). Dark teal tokens.
//
// columns: [{
//   key,                      // unique id
//   header,                   // column label
//   align,                    // 'left' | 'right' (default left)
//   sortable,                 // default true
//   value: (row) => primitive // value used for sorting (number|string); also
//                             //   the default display if no `cell`
//   cell: (row) => ReactNode  // optional custom cell renderer
// }]
//
// Usage:
//   <SortableTable columns={cols} rows={rows} initialSort={{key:'score',dir:'desc'}}
//     getRowId={(r)=>r.id} onRowClick={(r)=>…} />

function SortArrow({ dir }) {
  return (
    <span className="inline-block ml-1 align-middle" style={{ color: 'var(--link, #5EEAD4)', fontSize: 9 }}>
      {dir === 'asc' ? '▲' : '▼'}
    </span>
  )
}

export default function SortableTable({
  columns = [],
  rows = [],
  initialSort,
  getRowId = (r, i) => r.id ?? i,
  onRowClick,
  maxRows,
}) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? columns[0]?.key)
  const [sortDir, setSortDir] = useState(initialSort?.dir ?? 'asc')

  const col = columns.find((c) => c.key === sortKey)

  const sorted = useMemo(() => {
    if (!col) return rows
    const val = col.value || (() => 0)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir
    })
  }, [rows, col, sortDir])

  const toggleSort = (c) => {
    if (c.sortable === false) return
    if (c.key === sortKey) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortKey(c.key)
    // New column: numeric → desc-first, text → asc-first. Guard rows[0] so an
    // empty table with visible headers can't crash the accessor.
    const numeric = rows.length > 0 && typeof c.value?.(rows[0]) === 'number'
    setSortDir(numeric ? 'desc' : 'asc')
  }

  return (
    <div className="w-full overflow-x-auto thin-scrollbar">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.07) 0%, rgba(20,184,166,0.01) 100%)', borderBottom: '1px solid var(--hairline-teal, rgba(20,184,166,0.35))' }}>
            {columns.map((c) => {
              const isSorted = c.key === sortKey
              return (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`relative px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.18em] font-bold select-none transition-colors ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortable === false ? '' : 'cursor-pointer'}`}
                  style={{ color: isSorted ? 'var(--link, #5EEAD4)' : 'var(--text-label)', background: isSorted ? 'rgba(20,184,166,0.10)' : 'transparent' }}
                  onMouseEnter={c.sortable === false ? undefined : (e) => { if (!isSorted) e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={c.sortable === false ? undefined : (e) => { if (!isSorted) e.currentTarget.style.color = 'var(--text-label)' }}
                  scope="col"
                >
                  {c.header}
                  {isSorted && <SortArrow dir={sortDir} />}
                  {isSorted && <span className="absolute left-0 right-0 bottom-0 h-px" style={{ background: 'var(--link, #5EEAD4)' }} aria-hidden="true" />}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {(maxRows ? sorted.slice(0, maxRows) : sorted).map((row, i) => (
            <tr
              key={getRowId(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b transition-colors ${onRowClick ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
              style={{ borderColor: 'var(--cards-border)' }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-2.5 py-1.5 text-[12px] ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  style={{ color: 'var(--text-primary)' }}
                >
                  {c.cell ? c.cell(row) : (c.value ? c.value(row) : null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
