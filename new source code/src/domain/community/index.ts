import { roundKwh, roundTonnes, roundKg } from "../carbon/rounding";
import type { FactorVersion } from "../carbon/types";

export const MIN_COHORT_SIZE = 10;
export const MAX_SCENARIO_HOUSEHOLDS = 2000;
export const MIN_SCENARIO_HOUSEHOLDS = 10;
export const MAX_REDUCTION_PCT = 25;
export const MIN_REDUCTION_PCT = 1;
export const MIN_BASELINE_KWH = 150;
export const MAX_BASELINE_KWH = 600;

export interface CohortRecord {
  readonly householdId: string;
  readonly kwh: number;
  readonly consented: boolean;
  readonly isDemo: boolean;
  readonly confirmed: boolean;
  readonly township: string;
  readonly subzone?: string;
}

export type SuppressionReason = "cohort_too_small" | "no_eligible_records";

export interface CohortStats {
  readonly suppressed: false;
  readonly householdCount: number;
  readonly medianKwh: number;
  readonly p25Kwh: number;
  readonly p75Kwh: number;
  readonly coveragePct: number;
  readonly medianKgCo2e: number;
  /** Third-based band edges, published only with the aggregate. */
  readonly p33Kwh: number;
  readonly p67Kwh: number;
}

export interface SuppressedCohort {
  readonly suppressed: true;
  readonly reason: SuppressionReason;
  readonly minimumCohort: number;
}

export type CohortResult = CohortStats | SuppressedCohort;

export type CoarseBand = "lower_third" | "middle_third" | "upper_third" | "suppressed";

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/**
 * Demo and unconsented rows are excluded here, not only in the query layer.
 * Demo rows are only admitted when the caller explicitly asks for the demo
 * namespace, which is rendered separately and never written to a real cohort.
 */
export function eligibleRecords(
  records: readonly CohortRecord[],
  namespace: "real" | "demo" = "real",
): CohortRecord[] {
  return records.filter(
    (record) =>
      record.consented &&
      record.confirmed &&
      record.kwh > 0 &&
      (namespace === "demo" ? record.isDemo : !record.isDemo),
  );
}

/**
 * Computes cohort statistics with k-anonymity. Counts are rounded to the
 * nearest 5 above k so an exact count cannot be differenced against a known
 * neighbourhood.
 */
export function cohortStats(
  records: readonly CohortRecord[],
  factor: FactorVersion,
  options: {
    readonly minCohort?: number;
    readonly roundCounts?: boolean;
    readonly namespace?: "real" | "demo";
  } = {},
): CohortResult {
  const minCohort = options.minCohort ?? MIN_COHORT_SIZE;
  const namespace = options.namespace ?? "real";
  const eligible = eligibleRecords(records, namespace);
  if (eligible.length === 0) {
    return { suppressed: true, reason: "no_eligible_records", minimumCohort: minCohort };
  }
  if (eligible.length < minCohort) {
    return { suppressed: true, reason: "cohort_too_small", minimumCohort: minCohort };
  }
  const values = eligible.map((record) => record.kwh).sort((a, b) => a - b);
  const consented = records.filter(
    (record) => record.consented && (namespace === "demo" ? record.isDemo : !record.isDemo),
  ).length;
  const medianKwh = quantile(values, 0.5);
  return {
    suppressed: false,
    householdCount: options.roundCounts === false ? eligible.length : Math.round(eligible.length / 5) * 5,
    medianKwh: roundKwh(medianKwh),
    p25Kwh: Math.round(quantile(values, 0.25) / 5) * 5,
    p75Kwh: Math.round(quantile(values, 0.75) / 5) * 5,
    p33Kwh: Math.round(quantile(values, 1 / 3) / 5) * 5,
    p67Kwh: Math.round(quantile(values, 2 / 3) / 5) * 5,
    coveragePct: consented === 0 ? 0 : (eligible.length / consented) * 100,
    medianKgCo2e: roundKg(medianKwh * factor.kgPerKwh),
  };
}

export function coarseBand(
  kwh: number,
  stats: CohortResult,
): CoarseBand {
  if (stats.suppressed) return "suppressed";
  if (kwh < stats.p33Kwh) return "lower_third";
  if (kwh > stats.p67Kwh) return "upper_third";
  return "middle_third";
}

export interface ScenarioInput {
  readonly households: number;
  readonly reductionPct: number;
  readonly baselineKwh: number;
  readonly factor: FactorVersion;
  readonly cohortHouseholds?: number | null;
}

export interface ScenarioResult {
  readonly households: number;
  readonly reductionPct: number;
  readonly baselineKwh: number;
  readonly perHomeKwh: number;
  readonly savedKwh: number;
  readonly savedKg: number;
  readonly savedTonnes: number;
  readonly annualTonnes: number;
  readonly factor: FactorVersion;
  readonly label: "Scenario";
  readonly exceedsCohort: boolean;
}

export function scenario(input: ScenarioInput): ScenarioResult {
  const households = clampInt(input.households, MIN_SCENARIO_HOUSEHOLDS, MAX_SCENARIO_HOUSEHOLDS);
  const reductionPct = clamp(input.reductionPct, MIN_REDUCTION_PCT, MAX_REDUCTION_PCT);
  const baselineKwh = clamp(input.baselineKwh, MIN_BASELINE_KWH, MAX_BASELINE_KWH);
  const perHomeKwh = baselineKwh * (reductionPct / 100);
  const savedKwh = households * perHomeKwh;
  const savedKg = savedKwh * input.factor.kgPerKwh;
  const savedTonnes = savedKg / 1000;
  return {
    households,
    reductionPct,
    baselineKwh,
    perHomeKwh,
    savedKwh,
    savedKg,
    savedTonnes,
    annualTonnes: savedTonnes * 12,
    factor: input.factor,
    label: "Scenario",
    exceedsCohort:
      typeof input.cohortHouseholds === "number" && input.cohortHouseholds > 0
        ? households > input.cohortHouseholds
        : false,
  };
}

export function formatScenario(result: ScenarioResult): {
  savedKwh: string;
  savedTonnes: string;
  annualTonnes: string;
  perHomeKwh: string;
} {
  return {
    savedKwh: new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(result.savedKwh),
    savedTonnes: `${roundTonnes(result.savedTonnes).toFixed(2)} t CO₂e`,
    annualTonnes: `${roundTonnes(result.annualTonnes).toFixed(2)} t CO₂e`,
    perHomeKwh: new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 }).format(result.perHomeKwh),
  };
}

/** Household target: 10% below the trailing three-month median, rounded to 5 kWh. */
export function householdTarget(trailingKwh: readonly number[]): number {
  if (trailingKwh.length === 0) return 0;
  const sorted = [...trailingKwh].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
  return Math.round((median * 0.9) / 5) * 5;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
