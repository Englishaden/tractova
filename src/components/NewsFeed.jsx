import { useState } from 'react'
import newsFeed from '../data/newsFeed'

const PILLAR_STYLES = {
  offtake: { dot: 'bg-primary',     badge: 'bg-primary-50 text-primary-700 border-primary-200',     label: 'Offtake' },
  ix:      { dot: 'bg-accent-500',  badge: 'bg-accent-50 text-accent-700 border-accent-200',         label: 'Interconnection' },
  site:    { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200',               label: 'Site Control' },
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NewsFeed() {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? newsFeed
    : newsFeed.filter((item) => item.pillar === filter)

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Policy & Market Feed</h2>
          <span className="text-xs text-gray-400">{newsFeed.length} items</span>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1 mt-2.5">
          {['all', 'offtake', 'ix', 'site'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'ix' ? 'Interconnection' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Feed items */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {filtered.map((item) => {
          const pillar = PILLAR_STYLES[item.pillar] || PILLAR_STYLES.offtake
          const stateTags = item.tags.filter((t) => t.length === 2 && t === t.toUpperCase())

          return (
            <article key={item.id} className="px-5 py-4 hover:bg-surface transition-colors">
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${pillar.dot}`} />
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-primary leading-snug transition-colors"
                  >
                    {item.headline}
                  </a>
                  {item.summary && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${pillar.badge}`}>
                      {pillar.label}
                    </span>
                    {stateTags.map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 font-medium">
                        {tag}
                      </span>
                    ))}
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                      {item.source} · {formatDate(item.date)}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-gray-100 bg-chrome rounded-b-lg">
        <p className="text-xs text-gray-400">
          Manually curated · Automated feed in Iteration 5
        </p>
      </div>
    </div>
  )
}
