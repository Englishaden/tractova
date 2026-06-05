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
    notes:             row.notes || '',
    savedAt:           row.saved_at,
    lastObservedScore: row.last_observed_score ?? null,
    // Pass 5 cockpit columns (migrations 073/074); null-safe pre-migration.
    tags:              Array.isArray(row.tags) ? row.tags : [],
    followUpAt:        row.follow_up_at ?? null,
    followUpNote:      row.follow_up_note ?? '',
  }
}
