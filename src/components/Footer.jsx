import metrics from '../data/metrics'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-10">
      <div className="max-w-dashboard mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-700">tractova</span>
          <span className="text-xs text-gray-400">
            Intelligence for the moment that matters.
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-xs text-gray-400">
            Data last updated: {metrics.lastUpdated}
          </span>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            The Adder Newsletter ↗
          </a>
          <span className="text-xs text-gray-300">Iteration 1 — Dashboard Shell</span>
        </div>
      </div>
    </footer>
  )
}
