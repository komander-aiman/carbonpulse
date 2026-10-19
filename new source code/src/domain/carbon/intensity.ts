import type { DayClass, IntensityPoint, IntensityProfile, ModelVersion } from "./types";
import { getActiveFactor } from "./factors";

/**
 * The hourly intensity curve is assumed, not measured: Malaysia publishes no
 * interval grid intensity. Only its demand-weighted annual mean is anchored to
 * the published annual factor.
 */

const I_MIN = 0.45;
const I_MAX = 1.0;
const DEMAND_COEFF = 1;
const SOLAR_COEFF = 0.38;
const BASELOAD_OFFSET = 0.45;

const MODEL_VERSION: ModelVersion = {
  id: "diurnal-1.0.0+2026-10",
  description:
    "Demand-driven diurnal shape with solar suppression, annual mean anchored to the published Peninsular factor.",
  calibrationDate: "2026-10-01",
  annualMean: 0.74,
  minValue: I_MIN,
  maxValue: I_MAX,
};

type Keyframe = readonly [hour: number, value: number];

const DEMAND_KEYFRAMES: readonly Keyframe[] = [
  [0, 0.4],
  [4, 0.34],
  [6, 0.42],
  [8, 0.62],
  [10, 0.7],
  [12, 0.72],
  [14, 0.7],
  [16, 0.76],
  [18, 0.88],
  [20, 1.0],
  [21, 0.95],
  [22, 0.78],
  [23, 0.55],
  [24, 0.4],
];

const SOLAR_KEYFRAMES: readonly Keyframe[] = [
  [0, 0],
  [6, 0],
  [7, 0.18],
  [9, 0.55],
  [11, 0.85],
  [13, 1.0],
  [15, 0.8],
  [17, 0.4],
  [18, 0.12],
  [19, 0],
  [24, 0],
];

/** Clear-sky seasonality; the wetter monsoon months see less irradiation. */
const MONTH_SOLAR_SCALE: readonly number[] = [
  0.94, 0.98, 1.02, 1.04, 1.03, 1.0, 0.99, 0.99, 0.98, 0.96, 0.93, 0.92,
];

/** Fraction of each day class retained for the load shape. */
const DAY_CLASS_WEIGHTS: Readonly<Record<DayClass, number>> = {
  weekday: 5 / 7,
  saturday: 1 / 7,
  sunday: 1 / 7,
};

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function interpolate(keyframes: readonly Keyframe[], hour: number): number {
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    const current = keyframes[i]!;
    const next = keyframes[i + 1]!;
    if (hour >= current[0] && hour <= next[0]) {
      const span = next[0] - current[0];
      const t = span === 0 ? 0 : (hour - current[0]) / span;
      return current[1] + (next[1] - current[1]) * smoothstep(t);
    }
  }
  return keyframes[keyframes.length - 1]![1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Unnormalized intensity in factor units, before solving for k. */
function rawShape(month: number, hour: number): number {
  const demand = interpolate(DEMAND_KEYFRAMES, hour);
  const solar = interpolate(SOLAR_KEYFRAMES, hour) * (MONTH_SOLAR_SCALE[month - 1] ?? 1);
  return DEMAND_COEFF * demand + BASELOAD_OFFSET - SOLAR_COEFF * solar;
}

function daysInMonth(month: number): number {
  return new Date(Date.UTC(2024, month, 0)).getUTCDate();
}

interface WeightedPoint {
  readonly month: number;
  readonly hour: number;
  readonly dayClass: DayClass;
  readonly raw: number;
  readonly weight: number;
}

function weightedPoints(): WeightedPoint[] {
  const points: WeightedPoint[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const days = daysInMonth(month);
    const monthWeight = days / 365;
    for (const dayClass of ["weekday", "saturday", "sunday"] as const) {
      const dayWeight = monthWeight * DAY_CLASS_WEIGHTS[dayClass];
      for (let hour = 0; hour < 24; hour += 1) {
        points.push({
          month,
          hour,
          dayClass,
          raw: rawShape(month, hour),
          weight: dayWeight * interpolate(DEMAND_KEYFRAMES, hour + 0.5),
        });
      }
    }
  }
  return points;
}

function meanForScale(points: readonly WeightedPoint[], scale: number): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const point of points) {
    weightedSum += clamp(scale * point.raw, I_MIN, I_MAX) * point.weight;
    weightSum += point.weight;
  }
  return weightedSum / weightSum;
}

/**
 * Solves the normalization constant so the demand-weighted annual mean equals
 * the active grid emission factor. Bisection keeps the result deterministic and
 * tolerant of clamping at the bounds.
 */
function solveScale(points: readonly WeightedPoint[], target: number): number {
  let low = 0.01;
  let high = 10;
  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    if (meanForScale(points, mid) < target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

let cached: IntensityProfile | null = null;

export function buildIntensityProfile(): IntensityProfile {
  if (cached) return cached;
  const target = getActiveFactor("peninsular").kgPerKwh;
  const points = weightedPoints();
  const scale = solveScale(points, target);
  const rows: IntensityPoint[] = points.map((point) => ({
    month: point.month,
    hour: point.hour,
    dayClass: point.dayClass,
    kgPerKwh: Number(clamp(scale * point.raw, I_MIN, I_MAX).toFixed(4)),
  }));
  const index = new Map<string, number>();
  for (const row of rows) {
    index.set(`${row.month}|${row.hour}|${row.dayClass}`, row.kgPerKwh);
  }
  cached = { modelVersion: MODEL_VERSION, points: rows, index };
  return cached;
}

export function dayClassForDate(date: Date): DayClass {
  const day = date.getUTCDay();
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  return "weekday";
}

/** Malaysian wall-clock parts for an instant, fixed at UTC+8 with no DST. */
export function malaysiaParts(date: Date): { month: number; hour: number; dayClass: DayClass } {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    month: shifted.getUTCMonth() + 1,
    hour: shifted.getUTCHours(),
    dayClass: dayClassForDate(shifted),
  };
}

export function intensityAt(
  profile: IntensityProfile,
  month: number,
  hour: number,
  dayClass: DayClass,
): number {
  const value = profile.index.get(`${month}|${hour}|${dayClass}`);
  if (value === undefined) throw new Error(`Missing intensity for ${month}/${hour}/${dayClass}`);
  return value;
}

export function profileAnnualMean(profile: IntensityProfile): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (let month = 1; month <= 12; month += 1) {
    const days = daysInMonth(month);
    for (const dayClass of ["weekday", "saturday", "sunday"] as const) {
      for (let hour = 0; hour < 24; hour += 1) {
        const demand = interpolate(DEMAND_KEYFRAMES, hour + 0.5);
        const weight = (days / 365) * DAY_CLASS_WEIGHTS[dayClass] * demand;
        weightedSum += intensityAt(profile, month, hour, dayClass) * weight;
        weightSum += weight;
      }
    }
  }
  return weightedSum / weightSum;
}

export { I_MIN, I_MAX, MODEL_VERSION };
