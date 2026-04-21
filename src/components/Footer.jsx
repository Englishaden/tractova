import { useLocation } from 'react-router-dom'
import metrics from '../data/metrics'

export default function Footer() {
  const { pathname } = useLocation()
  const dark = pathname === '/library'

  return (
    <footer className={dark ? 'border-t border-white/[0.08] bg-[#080C14]' : 'border-t border-gray-200 bg-white mt-10'}>
      <div className="max-w-dashboard mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className={`text-sm font-semibold ${dark ? 'text-white/80' : 'text-gray-700'}`}>tractova</span>
          <span className={`text-xs ${dark ? 'text-white/35' : 'text-gray-400'}`}>
            Intelligence for the moment that matters.
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className={`text-xs ${dark ? 'text-white/35' : 'text-gray-400'}`}>
            Data last updated: {metrics.lastUpdated}
          </span>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs transition-colors ${dark ? 'text-white/35 hover:text-white/65' : 'text-gray-400 hover:text-gray-700'}`}
          >
            The Adder Newsletter ↗
          </a>
          <span className={`text-xs ${dark ? 'text-white/20' : 'text-gray-300'}`}>Iteration 1 — Dashboard Shell</span>
        </div>
      </div>
    </footer>
  )
}
