import { getActiveFactor } from "./factors";
import { getLoadProfile, DEFAULT_ARCHETYPE } from "./load-shape";
import { buildIntensityProfile, dayClassForDate, intensityAt } from "./intensity";
import type {
  ArchetypeId,
  DayClass,
  FactorVersion,
  FlatEstimate,
  IntensityProfile,
  ModelledEstimate,
} from "./types";

export const MAX_MONTHLY_KWH = 3000;
export const MIN_MONTHLY_KWH = 1;

export interface MonthlyInput {
  readonly kwh: number;
  /** Inclusive billing period start, `YYYY-MM-DD`. */
  readonly periodStart: string;
  /** Exclusive billing period end, `YYYY-MM-DD`. */
  readonly periodEnd: string;
  readonly archetype?: ArchetypeId;
  readonly factor?: FactorVersion;
  readonly intensity?: IntensityProfile;
}

export function flatEstimate(kwh: number, factor: FactorVersion = getActiveFactor()): FlatEstimate {
  if (!Number.isFinite(kwh) || kwh <= 0) throw new Error("kWh must be a positive number");
  return {
    kwh,
    kgCo2e: kwh * factor.kgPerKwh,
    factor,
    label: "Estimated",
  };
}

interface DayBucket {
  readonly dayClass: DayClass;
  readonly month: number;
  readonly share: number;
}

export function daysBetween(periodStart: string, periodEnd: string): Date[] {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid billing period");
  }
  if (end <= start) throw new Error("Billing period end must be after start");
  const days: Date[] = [];
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    days.push(cursor);
  }
  return days;
}

function dayBuckets(periodStart: string, periodEnd: string): DayBucket[] {
  const days = daysBetween(periodStart, periodEnd);
  return days.map((day) => ({
    dayClass: dayClassForDate(day),
    month: day.getUTCMonth() + 1,
    share: 1 / days.length,
  }));
}

/**
 * Allocates the confirmed monthly kWh across the period's days and hours using
 * the archetype weights, then weights each hour by the modelled intensity.
 * The load shape never changes the monthly total.
 */
export function modelledEstimate(input: MonthlyInput): ModelledEstimate {
  const { kwh } = input;
  if (!Number.isFinite(kwh) || kwh < MIN_MONTHLY_KWH) {
    throw new Error(`kWh must be at least ${MIN_MONTHLY_KWH}`);
  }
  if (kwh > MAX_MONTHLY_KWH) {
    throw new Error(`kWh above ${MAX_MONTHLY_KWH} is flagged for review`);
  }
  const factor = input.factor ?? getActiveFactor();
  const profile = input.intensity ?? buildIntensityProfile();
  const load = getLoadProfile(input.archetype ?? DEFAULT_ARCHETYPE);
  const buckets = dayBuckets(input.periodStart, input.periodEnd);

  let kgCo2e = 0;
  for (const bucket of buckets) {
    const weights = load.weights[bucket.dayClass];
    for (let hour = 0; hour < 24; hour += 1) {
      const hourKwh = kwh * bucket.share * (weights[hour] ?? 0);
      kgCo2e += hourKwh * intensityAt(profile, bucket.month, hour, bucket.dayClass);
    }
  }

  const flat = kwh * factor.kgPerKwh;
  const deltaKg = kgCo2e - flat;
  return {
    kwh,
    kgCo2e,
    flatKgCo2e: flat,
    deltaKg,
    deltaPct: flat === 0 ? 0 : (deltaKg / flat) * 100,
    factor,
    model: profile.modelVersion,
    label: "Modelled",
  };
}

/** Fraction of the monthly total that falls in each hour, averaged over the period. */
export function hourlyShares(
  periodStart: string,
  periodEnd: string,
  archetype: ArchetypeId,
): number[] {
  const load = getLoadProfile(archetype);
  const buckets = dayBuckets(periodStart, periodEnd);
  const shares = new Array<number>(24).fill(0);
  for (const bucket of buckets) {
    const weights = load.weights[bucket.dayClass];
    for (let hour = 0; hour < 24; hour += 1) {
      shares[hour] = (shares[hour] ?? 0) + bucket.share * (weights[hour] ?? 0);
    }
  }
  return shares;
}
