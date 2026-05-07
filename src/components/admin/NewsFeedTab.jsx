import { useState, useEffect, useCallback } from 'react'
import {
  getNewsFeed,
  upsertNewsItem,
  deleteNewsItem,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field, Badge } from '../../pages/Admin.jsx'

export default function NewsFeedTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('news_feed')
      const data = await getNewsFeed()
      setItems(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const blankItem = { headline: '', source: '', url: '', date: new Date().toISOString().split('T')[0], pillar: 'offtake', type: 'market-update', summary: '', tags: [], stateIds: [] }

  const startAdd = () => {
    setAdding(true)
    setEditData({ ...blankItem })
    setEditId(null)
    setError(null)
  }

  const startEdit = (item) => {
    setEditId(item.id)
    setEditData({ ...item })
    setAdding(false)
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      if (adding) {
        await upsertNewsItem({
          headline: editData.headline,
          source: editData.source,
          url: editData.url,
          published_at: editData.date,
          pillar: editData.pillar,
          type: editData.type,
          summary: editData.summary,
          tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()) : editData.tags,
          state_ids: typeof editData.stateIds === 'string' ? editData.stateIds.split(',').map(t => t.trim()) : editData.stateIds,
          is_active: true,
        })
      } else {
        await upsertNewsItem({
          id: editId,
          headline: editData.headline,
          source: editData.source,
          url: editData.url,
          published_at: editData.date,
          pillar: editData.pillar,
          type: editData.type,
          summary: editData.summary,
          tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()) : editData.tags,
          state_ids: typeof editData.stateIds === 'string' ? editData.stateIds.split(',').map(t => t.trim()) : editData.stateIds,
          is_active: true,
        })
      }
      setEditId(null)
      setAdding(false)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Remove this news item? This will deactivate it from the feed.')) return
    try {
      await deleteNewsItem(id)
      await load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading news feed...</p>

  const isFormOpen = editId || adding

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">{items.length} active items</span>
        <button onClick={startAdd} className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors">+ Add item</button>
      </div>

      {isFormOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">{adding ? 'New item' : `Editing: ${editData.headline?.slice(0, 40)}...`}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Headline" value={editData.headline} field="headline" onChange={handleChange} className="md:col-span-2" />
            <Field label="Source" value={editData.source} field="source" onChange={handleChange} />
            <Field label="URL" value={editData.url} field="url" onChange={handleChange} />
            <Field label="Date" value={editData.date} field="date" onChange={handleChange} type="date" />
            <Field label="Pillar" value={editData.pillar} field="pillar" onChange={handleChange} options={['offtake', 'ix', 'site']} />
            <Field label="Type" value={editData.type} field="type" onChange={handleChange} options={['policy-alert', 'market-update']} />
            <Field label="State IDs (comma-separated)" value={Array.isArray(editData.stateIds) ? editData.stateIds.join(', ') : editData.stateIds} field="stateIds" onChange={handleChange} />
            <Field label="Summary" value={editData.summary} field="summary" onChange={handleChange} type="textarea" className="md:col-span-2" />
          </div>
          <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
            <Button variant="accent" onClick={handleSave} loading={saving}>
              {saving ? 'Saving...' : adding ? 'Add item' : 'Save changes'}
            </Button>
            <Button variant="link" onClick={() => { setEditId(null); setAdding(false) }} disabled={saving}>Cancel</Button>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900 font-medium truncate">{item.headline}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge color={item.pillar === 'offtake' ? 'green' : item.pillar === 'ix' ? 'yellow' : 'blue'}>{item.pillar}</Badge>
                <Badge>{item.type}</Badge>
                <span className="text-[10px] text-gray-400">{item.source} — {item.date}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-xs text-gray-400 hover:text-teal-700 transition-colors">Edit</button>
              <button onClick={() => handleDeactivate(item.id)} className="text-xs text-gray-400 hover:text-red-500 transition-colors">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
