export type Region = "peninsular" | "sabah" | "sarawak";

export type DayClass = "weekday" | "saturday" | "sunday";

export type ArchetypeId = "ac_evening" | "ac_all_day" | "workday_absent" | "mixed";

export type EvidenceLabel = "Recorded" | "Estimated" | "Modelled" | "Scenario";

export type DataStatus = "live" | "cached" | "demo";

export interface FactorVersion {
  readonly id: string;
  readonly region: Region;
  readonly year: number;
  readonly kgPerKwh: number;
  readonly status: "provisional" | "final";
  readonly basis: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly publishedOn: string;
  readonly supersedesId: string | null;
}

export interface ModelVersion {
  readonly id: string;
  readonly description: string;
  readonly calibrationDate: string;
  readonly annualMean: number;
  readonly minValue: number;
  readonly maxValue: number;
}

export interface IntensityPoint {
  readonly month: number;
  readonly hour: number;
  readonly dayClass: DayClass;
  readonly kgPerKwh: number;
}

export interface IntensityProfile {
  readonly modelVersion: ModelVersion;
  readonly points: readonly IntensityPoint[];
  /** Lookup keyed by `${month}|${hour}|${dayClass}`. */
  readonly index: ReadonlyMap<string, number>;
}

export interface LoadProfile {
  readonly archetype: ArchetypeId;
  /** Hours 0..23 for each day class, each array summing to 1. */
  readonly weights: Readonly<Record<DayClass, readonly number[]>>;
}

export interface FlatEstimate {
  readonly kwh: number;
  readonly kgCo2e: number;
  readonly factor: FactorVersion;
  readonly label: "Estimated";
}

export interface ModelledEstimate {
  readonly kwh: number;
  readonly kgCo2e: number;
  readonly flatKgCo2e: number;
  readonly deltaKg: number;
  readonly deltaPct: number;
  readonly factor: FactorVersion;
  readonly model: ModelVersion;
  readonly label: "Modelled";
}

export interface IntervalReading {
  /** Start of the interval, ISO 8601 with explicit offset. */
  readonly start: string;
  readonly kwh: number;
}

export interface IntervalValidationIssue {
  readonly index: number;
  readonly code:
    | "invalid_timestamp"
    | "negative_kwh"
    | "duplicate_timestamp"
    | "gap_too_large"
    | "unit_suspected"
    | "uneven_duration";
  readonly message: string;
}

export interface IntervalValidationReport {
  readonly ok: boolean;
  readonly issues: readonly IntervalValidationIssue[];
  readonly rowCount: number;
  readonly duplicateCount: number;
  readonly gapCount: number;
  readonly unitErrorCount: number;
  readonly coveragePct: number;
  readonly totalKwh: number;
  readonly start: string | null;
  readonly end: string | null;
  readonly intervalMinutes: number | null;
}

export interface IntervalEstimate {
  readonly kwh: number;
  readonly kgCo2e: number;
  readonly flatKgCo2e: number;
  readonly deltaKg: number;
  readonly coveragePct: number;
  readonly intervalCount: number;
  readonly factor: FactorVersion;
  readonly model: ModelVersion;
  readonly label: "Modelled";
}
