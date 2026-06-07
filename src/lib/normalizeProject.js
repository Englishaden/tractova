// Canonical Supabase `projects` row → camelCase shape used across the app
// (desktop Library, MobileLibrary, ProjectCard, the analytics). One source of
// truth so the two Library surfaces can't drift (they did: MobileLibrary used
// projectName/capacityMw while ProjectCard + analytics read name/mw/tags).
export function normalizeProject(row) {
  return {
    id:                row.id,
    name:              row.name,
    state:             row.state,
    stateName:         row.state_name,
    county:            row.county,
    mw:                row.mw,
    stage:             row.stage,
    technology:        row.technology,
    structure:         row.structure,
    csProgram:         row.cs_program,
    csStatus:          row.cs_status,
    servingUtility:    row.serving_utility,
    feasibilityScore:  row.opportunity_score,
    ixDifficulty:      row.ix_difficulty,
    // Target COD year (migration 070) — drives the federal tax-credit TIMING
    // pillar (§48E/§45Y safe-harbor). Was previously DROPPED here, so every
    // Library surface passed codYear=undefined to scoreSavedProject while the
    // Lens passed the real value — a silent source of Library-vs-Lens drift.
    codTargetYear:     row.cod_target_year ?? null,
    notes:             row.notes || '',
    savedAt:           row.saved_at,
    lastObservedScore: row.last_observed_score ?? null,
    // Pass 5 cockpit columns (migrations 073/074); null-safe pre-migration.
    tags:              Array.isArray(row.tags) ? row.tags : [],
    followUpAt:        row.follow_up_at ?? null,
    followUpNote:      row.follow_up_note ?? '',
  }
}
