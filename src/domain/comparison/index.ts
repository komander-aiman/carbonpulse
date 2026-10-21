import { roundKg } from "../carbon/rounding";
import type { FactorVersion } from "../carbon/types";
import { coarseBand, quantile, type CoarseBand, type Namespace } from "../community";
import type { ProfileBand } from "../profile";

export const COMPARISON_MIN_GROUP = 5;

export type ComparisonTier = "T1" | "T2" | "T3";

export interface ComparableHousehold {
  readonly householdId: string;
  readonly kwh: number;
  readonly consented: boolean;
  readonly isDemo: boolean;
  readonly confirmed: boolean;
  readonly township: string;
  readonly subzone: string;
  /** `null` when the household has no completed questionnaire. */
  readonly bandKey: string | null;
}

export interface ComparisonInput {
  readonly viewer: {
    readonly householdId: string;
    readonly kwh: number;
    readonly subzone: string;
    readonly township: string;
    readonly bandKey: string | null;
  };
  readonly records: readonly ComparableHousehold[];
  readonly factor: FactorVersion;
  readonly namespace?: Namespace;
}

export interface ComparisonResult {
  readonly suppressed: false;
  readonly tier: ComparisonTier;
  readonly tierLabel: string;
  readonly groupN: number;
  readonly medianKwh: number;
  readonly p33Kwh: number;
  readonly p67Kwh: number;
  readonly band: CoarseBand;
  readonly differenceKwh: number;
  readonly differenceKg: number;
}

export interface SuppressedComparison {
  readonly suppressed: true;
  readonly reason: "no_profile" | "group_too_small" | "no_records";
  readonly minimumGroup: number;
}

export type Comparison = ComparisonResult | SuppressedComparison;

export const TIER_LABELS: Readonly<Record<ComparisonTier, string>> = {
  T1: "Similar homes in your zone",
  T2: "Households in your zone",
  T3: "Households in City of Elmina",
};

function round5(value: number): number {
  return Math.round(value / 5) * 5;
}

function resolveTier(input: ComparisonInput): { tier: ComparisonTier; rows: ComparableHousehold[] } | null {
  const { viewer } = input;
  // The viewer is part of their own group. Excluding them would make a group of
  // exactly k report as suppressed to every member.
  const others = input.records.filter((record) => record.householdId !== viewer.householdId);
  const viewerRow: ComparableHousehold = {
    householdId: viewer.householdId,
    kwh: viewer.kwh,
    consented: true,
    isDemo: input.namespace === "demo",
    confirmed: true,
    township: viewer.township,
    subzone: viewer.subzone,
    bandKey: viewer.bandKey,
  };
  const eligible = [...others, viewerRow].filter(
    (record) =>
      record.consented &&
      record.confirmed &&
      record.kwh > 0 &&
      (input.namespace === "demo" ? record.isDemo : !record.isDemo),
  );

  const tiers: { tier: ComparisonTier; rows: ComparableHousehold[] }[] = [
    {
      tier: "T1",
      rows: eligible.filter(
        (record) => record.subzone === viewer.subzone && record.bandKey !== null && record.bandKey === viewer.bandKey,
      ),
    },
    { tier: "T2", rows: eligible.filter((record) => record.subzone === viewer.subzone) },
    { tier: "T3", rows: eligible.filter((record) => record.township === viewer.township) },
  ];

  for (const candidate of tiers) {
    if (candidate.rows.length >= COMPARISON_MIN_GROUP) return candidate;
  }
  return null;
}

export function compareWithSimilarHomes(input: ComparisonInput): Comparison {
  if (input.viewer.bandKey === null) {
    return { suppressed: true, reason: "no_profile", minimumGroup: COMPARISON_MIN_GROUP };
  }
  if (input.records.length === 0) {
    return { suppressed: true, reason: "no_records", minimumGroup: COMPARISON_MIN_GROUP };
  }

  const resolved = resolveTier(input);
  if (!resolved) {
    return { suppressed: true, reason: "group_too_small", minimumGroup: COMPARISON_MIN_GROUP };
  }

  const values = resolved.rows.map((record) => record.kwh).sort((a, b) => a - b);
  const median = quantile(values, 0.5);
  const p33 = round5(quantile(values, 1 / 3));
  const p67 = round5(quantile(values, 2 / 3));
  const difference = input.viewer.kwh - median;

  return {
    suppressed: false,
    tier: resolved.tier,
    tierLabel: TIER_LABELS[resolved.tier],
    groupN: round5(resolved.rows.length),
    medianKwh: round5(median),
    p33Kwh: p33,
    p67Kwh: p67,
    band: coarseBand(input.viewer.kwh, {
      suppressed: false,
      householdCount: resolved.rows.length,
      medianKwh: median,
      p25Kwh: round5(quantile(values, 0.25)),
      p75Kwh: round5(quantile(values, 0.75)),
      p33Kwh: p33,
      p67Kwh: p67,
      coveragePct: 100,
      medianKgCo2e: roundKg(median * input.factor.kgPerKwh),
    }),
    differenceKwh: round5(difference),
    differenceKg: roundKg(difference * input.factor.kgPerKwh),
  };
}

export function comparisonCopy(result: Comparison): string {
  if (result.suppressed) {
    if (result.reason === "no_profile") {
      return "Add your household profile to compare with similar homes. It takes about a minute and you can skip any part of it.";
    }
    return "Not enough data yet · similar homes need at least 5 consenting households with a confirmed bill in this period. Your own bill still counts toward that group.";
  }
  const direction = result.differenceKwh >= 0 ? "more" : "less";
  const magnitude = Math.abs(result.differenceKwh);
  if (result.tier === "T1") {
    return `You used ${magnitude} kWh ${direction} than the median of ${result.groupN} households with a similar home and household size in your zone. This is a descriptive comparison, not a rating.`;
  }
  if (result.tier === "T2") {
    return `We could not find 5 homes with your exact profile yet, so this compares you with ${result.groupN} consenting households across your zone. Your usage is ${magnitude} kWh ${result.differenceKwh >= 0 ? "above" : "below"} their median.`;
  }
  return `Your zone does not yet have enough matching households, so this compares you with ${result.groupN} consenting households across City of Elmina.`;
}

export function bandLabel(band: CoarseBand): string {
  switch (band) {
    case "lower_third":
      return "Lower third of the group";
    case "middle_third":
      return "Middle third of the group";
    case "upper_third":
      return "Upper third of the group";
    default:
      return "Not enough data yet";
  }
}

export function bandFromKey(key: string): ProfileBand | null {
  const [homeType, sizeBand, airconBand] = key.split("|");
  if (!homeType || !sizeBand || !airconBand) return null;
  return {
    homeType: homeType as ProfileBand["homeType"],
    sizeBand: sizeBand as ProfileBand["sizeBand"],
    airconBand: airconBand as ProfileBand["airconBand"],
    key,
  };
}
