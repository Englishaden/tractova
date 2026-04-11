// Dashboard header metrics — seeded for Iteration 1
// These will be auto-calculated from statePrograms data in Iteration 5

const metrics = {
  statesWithActiveCS: 14,
  statesWithAnyCS: 18,        // active + limited + pending
  utilitiesWithIXHeadroom: 34,
  policyAlertsThisWeek: 7,
  avgCSCapacityRemaining: "62%",
  totalMWInPipeline: 3250,    // sum of capacityMW across active/limited states
  lastUpdated: "2026-04-11",
}

export default metrics
