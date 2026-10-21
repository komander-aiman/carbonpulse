export const DEMO_HOUSEHOLD = {
  id: "demo-household",
  displayName: "Aiman",
  township: "elmina",
  subzone: "elmina-north",
  archetype: "ac_evening" as const,
  isDemo: true,
};

/** Six confirmed billing periods, most recent last. */
export const DEMO_PERIODS = [
  { periodStart: "2026-04-01", periodEnd: "2026-05-01", kwh: 343, label: "April 2026" },
  { periodStart: "2026-05-01", periodEnd: "2026-06-01", kwh: 329, label: "May 2026" },
  { periodStart: "2026-06-01", periodEnd: "2026-07-01", kwh: 335, label: "June 2026" },
  { periodStart: "2026-07-01", periodEnd: "2026-08-01", kwh: 317, label: "July 2026" },
  { periodStart: "2026-08-01", periodEnd: "2026-09-01", kwh: 326, label: "August 2026" },
  { periodStart: "2026-09-01", periodEnd: "2026-10-01", kwh: 300, label: "September 2026" },
] as const;

export const DEMO_CURRENT_PERIOD = DEMO_PERIODS[DEMO_PERIODS.length - 1];

export const DEMO_COMPLETED_ACTIONS: readonly string[] = ["temperature"];

export const CONTEXT_STATS = {
  nationalCo2PerCapita: { value: 8.039, unit: "t CO2e per person", year: 2023, sourceId: "S12" },
  nationalGhg: { value: 361110.6, unit: "Gg CO2e", year: 2023, sourceId: "S4" },
  nationalEnergyGhg: { value: 285678.59, unit: "Gg CO2e", year: 2023, sourceId: "S4" },
  elminaHouseholds: { value: 128, unit: "opted-in demo households", sourceId: "demo" },
} as const;

/**
 * Synthetic cohort used for the demo scenario. Because these rows carry
 * `isDemo: true`, the aggregation layer excludes them from real statistics and
 * the UI labels every figure Demo.
 */
export const DEMO_COHORT_SIZE = 128;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Deterministic pseudo-cohort so demo statistics never change between renders. */
export function demoCohort(): {
  householdId: string;
  kwh: number;
  consented: boolean;
  isDemo: boolean;
  confirmed: boolean;
  township: string;
  subzone: string;
}[] {
  const random = seededRandom(20261019);
  const subzones = ["elmina-north", "elmina-east", "elmina-south", "elmina-west", "elmina-central", "elmina-lake"];
  return Array.from({ length: DEMO_COHORT_SIZE }, (_, index) => {
    const base = 250 + random() * 160;
    return {
      householdId: `demo-${index + 1}`,
      kwh: Math.round(base),
      consented: true,
      isDemo: true,
      confirmed: true,
      township: "elmina",
      subzone: subzones[index % subzones.length]!,
    };
  });
}

export const PRECINCT_METRICS = {
  optedIn: 128,
  monthlySubmissions: 96,
  actionsCompleted: 214,
} as const;
