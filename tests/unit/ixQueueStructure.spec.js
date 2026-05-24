import { describe, it, expect, vi } from 'vitest'

// Fixture rows keyed by state_id; the mocked supabase returns them filtered by
// the .eq('state_id', …) call. Shapes mirror ix_queue_data post-migration 068
// (one row per state/utility/metering_type).
const ROWS = {
  // NY — CS only (NYSERDA CDG=Yes), one utility.
  NYX: [
    { utility_name: 'Con Edison', metering_type: 'community_solar', projects_in_queue: 580, mw_pending: 119, completed_projects: 100, completed_mw: 50, avg_study_months: null, withdrawal_pct: null, avg_upgrade_cost_mw: null, queue_trend: 'stable', data_source: 'nyserda_cdg', iso: 'NYISO', fetched_at: '2026-05-20T00:00:00Z' },
  ],
  // NJ — capture-all: net metering dominant + CS + other, across two EDCs.
  NJX: [
    { utility_name: 'JCP&L', metering_type: 'net_metering',    projects_in_queue: 3829, mw_pending: 63,  completed_projects: null, completed_mw: null, queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
    { utility_name: 'JCP&L', metering_type: 'community_solar', projects_in_queue: 33,   mw_pending: 84,  completed_projects: null, completed_mw: null, queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
    { utility_name: 'JCP&L', metering_type: 'other',           projects_in_queue: 21,   mw_pending: 5,   completed_projects: null, completed_mw: null, queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
    { utility_name: 'PSE&G', metering_type: 'net_metering',    projects_in_queue: 4137, mw_pending: 71,  completed_projects: 3075, completed_mw: 25, queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
    { utility_name: 'PSE&G', metering_type: 'community_solar', projects_in_queue: 129,  mw_pending: 276, completed_projects: 0,    completed_mw: 0,  queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
    { utility_name: 'PSE&G', metering_type: 'other',           projects_in_queue: 3,    mw_pending: 8,   completed_projects: 0,    completed_mw: 0,  queue_trend: 'stable', data_source: 'nj_ic_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
  ],
  // VA — Dominion fuel-type-only queue: all 'unknown', no CS.
  VAX: [
    { utility_name: 'Dominion', metering_type: 'unknown', projects_in_queue: 717, mw_pending: 3643, completed_projects: 96, completed_mw: 886, queue_trend: 'stable', data_source: 'va_dominion_queue', iso: 'PJM', fetched_at: '2026-05-20T00:00:00Z' },
  ],
}

vi.mock('../../src/lib/supabase', () => {
  const makeChain = () => {
    let state = null
    const chain = {
      select: () => chain,
      eq: (col, val) => { if (col === 'state_id') state = val; return chain },
      order: () => Promise.resolve({ data: (ROWS[state] || []).slice(), error: null }),
    }
    return chain
  }
  return { supabase: { from: () => makeChain() } }
})

const { getIXQueueData, getIXQueueSummary } = await import('../../src/lib/programData.js')

describe('getIXQueueData — group (utility, structure) rows back to per-utility cards', () => {
  it('sums across structures per utility and carries the breakdown', async () => {
    const data = await getIXQueueData('NJX')
    expect(data.utilities).toHaveLength(2)

    const jcpl = data.utilities.find(u => u.name === 'JCP&L')
    expect(jcpl.projectsInQueue).toBe(3883)        // 3829 + 33 + 21
    expect(jcpl.mwPending).toBe(152)               // 63 + 84 + 5
    expect(jcpl.completedProjects).toBeNull()      // all three structures null → unknown ≠ zero
    expect(jcpl.structures).toHaveLength(3)
    expect(jcpl.structures[0].meteringType).toBe('net_metering') // sorted desc by count

    const pseg = data.utilities.find(u => u.name === 'PSE&G')
    expect(pseg.projectsInQueue).toBe(4269)        // 4137 + 129 + 3
    expect(pseg.completedProjects).toBe(3075)      // observed (file tracks In-Service)
  })

  it('rolls up state-wide availableStructures sorted by pipeline count', async () => {
    const data = await getIXQueueData('NJX')
    expect(data.availableStructures[0].meteringType).toBe('net_metering')
    expect(data.availableStructures[0].projectsInQueue).toBe(7966) // 3829 + 4137
    const cs = data.availableStructures.find(s => s.meteringType === 'community_solar')
    expect(cs.projectsInQueue).toBe(162)           // 33 + 129
  })
})

describe('getIXQueueSummary — structure view keeps the headline honest', () => {
  it('defaults to the Community Solar view when CS rows exist (the honesty guard)', async () => {
    const s = await getIXQueueSummary('NJX', 5)
    expect(s.view).toBe('community_solar')
    // The headline must be CS only (162) — NOT the 8k all-DG total that would
    // mislabel net metering as "CS projects".
    expect(s.totalProjects).toBe(162)
    expect(s.totalMW).toBe(360)                    // 84 + 276
    expect(s.availableStructures).toHaveLength(3)
  })

  it('switches to an explicit structure view', async () => {
    const s = await getIXQueueSummary('NJX', 5, 'net_metering')
    expect(s.view).toBe('net_metering')
    expect(s.totalProjects).toBe(7966)             // 3829 + 4137
  })

  it("'all' shows every structure", async () => {
    const s = await getIXQueueSummary('NJX', 5, 'all')
    expect(s.view).toBeNull()
    expect(s.totalProjects).toBe(8152)             // 3883 + 4269
  })

  it('falls back to all structures when the state has no CS (VA = unknown only)', async () => {
    const s = await getIXQueueSummary('VAX', 5)
    expect(s.view).toBeNull()
    expect(s.totalProjects).toBe(717)
    expect(s.signalType).toBe('cs_pipeline')       // va_dominion_queue is a registered source
  })

  it('CS-only state is unchanged by the view default (NY)', async () => {
    const s = await getIXQueueSummary('NYX', 5)
    expect(s.view).toBe('community_solar')
    expect(s.totalProjects).toBe(580)
    expect(s.completedProjects).toBe(100)
  })
})
