import { useState, useEffect, useCallback } from 'react'
import {
  getAllRevenueRates,
  updateRevenueRates,
  invalidateCache,
} from '../../lib/programData'
import { Button } from '../ui'
import { Field } from '../../pages/Admin.jsx'

export default function RevenueRatesTab() {
  const [rates, setRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      invalidateCache('revenue_rates_all')
      const data = await getAllRevenueRates()
      setRates(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEdit = (r) => {
    setEditId(r.state_id)
    setEditData({ ...r })
    setError(null)
  }

  const handleChange = (field, value) => setEditData(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const { state_id, updated_at, ...fields } = editData
      await updateRevenueRates(state_id, fields)
      setEditId(null)
      await load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading revenue rates...</p>

  const NUM_FIELDS = [
    { key: 'bill_credit_cents_kwh', label: 'Bill Credit (¢/kWh)', group: 'cs' },
    { key: 'rec_per_mwh', label: 'REC ($/MWh)', group: 'cs' },
    { key: 'itc_pct', label: 'ITC %', group: 'cs' },
    { key: 'itc_adder_pct', label: 'ITC Adder %', group: 'cs' },
    { key: 'capacity_factor_pct', label: 'Cap Factor %', group: 'cs' },
    { key: 'installed_cost_per_watt', label: 'Install $/W', group: 'cs' },
    { key: 'ci_ppa_rate_cents_kwh', label: 'PPA Rate (¢/kWh)', group: 'ci' },
    { key: 'ci_retail_rate_cents_kwh', label: 'Retail Rate (¢/kWh)', group: 'ci' },
    { key: 'ci_escalator_pct', label: 'Escalator %', group: 'ci' },
    { key: 'ci_installed_cost_per_watt', label: 'Install $/W', group: 'ci' },
    { key: 'bess_capacity_per_kw_year', label: 'Cap $/kW-yr', group: 'bess' },
    { key: 'bess_demand_charge_per_kw_month', label: 'Demand $/kW-mo', group: 'bess' },
    { key: 'bess_arbitrage_per_mwh', label: 'Arb $/MWh', group: 'bess' },
    { key: 'bess_installed_cost_per_kwh', label: 'Install $/kWh', group: 'bess' },
  ]

  return (
    <div>
      {editId ? (
        <div>
          <button onClick={() => setEditId(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-4">← Back to list</button>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">{editData.label || editId}</h3>
            <span className="text-xs text-gray-400">State ID: {editId}</span>

            {['cs', 'ci', 'bess'].map(group => (
              <div key={group} className="mt-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  {group === 'cs' ? 'Community Solar' : group === 'ci' ? 'C&I Solar' : 'BESS'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {NUM_FIELDS.filter(f => f.group === group).map(f => (
                    <Field key={f.key} label={f.label} value={editData[f.key]} field={f.key} onChange={handleChange} type="number" />
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-5">
              <Field label="Notes" value={editData.notes} field="notes" onChange={handleChange} type="textarea" />
            </div>

            <div className="flex gap-3 pt-4 mt-5 border-t border-gray-100">
              <Button variant="accent" onClick={handleSave} loading={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button variant="link" onClick={() => setEditId(null)} disabled={saving}>Cancel</Button>
            </div>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rates.map(r => (
            <button
              key={r.state_id}
              onClick={() => startEdit(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-teal-500/40 hover:bg-teal-50/30 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-900 w-7">{r.state_id}</span>
                  <span className="text-sm text-gray-600 truncate">{r.label || '—'}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:flex items-center gap-3">
                    <span className="text-xs text-gray-400 tabular-nums">{r.bill_credit_cents_kwh}¢</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">${r.rec_per_mwh} REC</span>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-400 tabular-nums">{r.itc_pct}%+{r.itc_adder_pct}%</span>
                  </div>
                  <span className="text-xs text-gray-300 group-hover:text-teal-700 transition-colors">Edit →</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
