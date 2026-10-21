import { roundKg } from "../carbon/rounding";
import type { FactorVersion } from "../carbon/types";
import {
  MIN_COHORT_SIZE,
  eligibleRecords,
  quantile,
  type CoarseBand,
  type CohortRecord,
  type Namespace,
  type SuppressionReason,
} from "../community";

export const DEFAULT_K_THRESHOLD = 5;

export interface ZoneStats {
  readonly suppressed: false;
  readonly zoneId: string;
  readonly householdCount: number;
  readonly medianKwh: number;
  readonly p25Kwh: number;
  readonly p75Kwh: number;
  readonly p33Kwh: number;
  readonly p67Kwh: number;
  readonly medianKgCo2e: number;
  readonly coveragePct: number;
  readonly kThreshold: number;
}

export interface SuppressedZone {
  readonly suppressed: true;
  readonly zoneId: string;
  readonly reason: SuppressionReason;
  readonly kThreshold: number;
}

export type ZoneResult = ZoneStats | SuppressedZone;

/** Every published zone value is rounded to 5 (D24). */
function round5(value: number): number {
  return Math.round(value / 5) * 5;
}

/**
 * Zone aggregate. This is deliberately separate code from `scenario()`: zone
 * statistics are consent-gated, persisted snapshots; a scenario is unbounded,
 * unpersisted, and labelled Scenario.
 */
export function zoneStats(
  zoneId: string,
  records: readonly CohortRecord[],
  factor: FactorVersion,
  options: {
    readonly kThreshold?: number;
    readonly namespace?: Namespace;
  } = {},
): ZoneResult {
  const kThreshold = options.kThreshold ?? DEFAULT_K_THRESHOLD;
  const namespace = options.namespace ?? "real";
  const inZone = records.filter((record) => record.subzone === zoneId);
  const eligible = eligibleRecords(inZone, namespace);

  if (eligible.length === 0) {
    return { suppressed: true, zoneId, reason: "no_eligible_records", kThreshold };
  }
  if (eligible.length < kThreshold) {
    return { suppressed: true, zoneId, reason: "cohort_too_small", kThreshold };
  }

  const values = eligible.map((record) => record.kwh).sort((a, b) => a - b);
  const consented = inZone.filter(
    (record) => record.consented && (namespace === "demo" ? record.isDemo : !record.isDemo),
  ).length;

  return {
    suppressed: false,
    zoneId,
    householdCount: round5(eligible.length),
    medianKwh: round5(quantile(values, 0.5)),
    p25Kwh: round5(quantile(values, 0.25)),
    p75Kwh: round5(quantile(values, 0.75)),
    p33Kwh: round5(quantile(values, 1 / 3)),
    p67Kwh: round5(quantile(values, 2 / 3)),
    medianKgCo2e: roundKg(quantile(values, 0.5) * factor.kgPerKwh),
    coveragePct: consented === 0 ? 0 : Math.min(100, (eligible.length / consented) * 100),
    kThreshold,
  };
}

export function zoneBand(kwh: number, result: ZoneResult): CoarseBand {
  if (result.suppressed) return "suppressed";
  if (kwh < result.p33Kwh) return "lower_third";
  if (kwh > result.p67Kwh) return "upper_third";
  return "middle_third";
}

export const SUPPRESSION_COPY = "Not enough data yet";

export function zoneLabel(id: string): string {
  switch (id) {
    case "elmina-north":
      return "Elmina North";
    case "elmina-central":
      return "Elmina Central";
    case "elmina-west":
      return "Elmina West";
    case "elmina-east":
      return "Elmina East";
    case "elmina-south":
      return "Elmina South";
    case "elmina-lake":
      return "Elmina Lake";
    default:
      return id;
  }
}

export { MIN_COHORT_SIZE };
