import { useState, useEffect } from 'react'
import { getDashboardMetrics } from '../lib/programData'

export default function Footer() {
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    getDashboardMetrics().then(m => setLastUpdated(m?.lastUpdated)).catch(err => {
      // Footer "last updated" caption is a nice-to-have; degrades to no
      // caption rather than blocking footer render.
      console.warn('[Footer] getDashboardMetrics failed:', err)
    })
  }, [])

  return (
    <footer className="border-t border-gray-200 bg-white mt-10">
      <div className="max-w-dashboard mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span className="text-base font-serif font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.02em' }}>Tractova</span>
          <span className="text-xs text-gray-400">
            Intelligence for the moment that matters.
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span className="text-xs font-mono tabular-nums text-gray-400">
            Data last updated: {lastUpdated ?? '—'}
          </span>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            The Adder Newsletter ↗
          </a>
          <span className="text-xs font-mono text-gray-300">© {new Date().getFullYear()} Tractova</span>
        </div>
      </div>
    </footer>
  )
}
