import { getActiveFactor } from "./factors";
import { buildIntensityProfile, malaysiaParts, intensityAt } from "./intensity";
import type {
  FactorVersion,
  IntensityProfile,
  IntervalEstimate,
  IntervalReading,
  IntervalValidationIssue,
  IntervalValidationReport,
} from "./types";

export const MAX_INTERVAL_KWH = 50;
export const MAX_GAP_MINUTES = 120;
export const MAX_COVERAGE_GAP_PCT = 2;
export const DEFAULT_INTERVAL_MINUTES = 30;

function parseInstant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

/**
 * Validates interval readings before anything is persisted. Returns a complete
 * report; callers must refuse to save when `ok` is false.
 */
export function validateIntervals(readings: readonly IntervalReading[]): IntervalValidationReport {
  const issues: IntervalValidationIssue[] = [];
  const seen = new Set<number>();
  const parsed: { index: number; ms: number; kwh: number }[] = [];

  for (const [index, reading] of readings.entries()) {
    const ms = parseInstant(reading.start);
    if (ms === null) {
      issues.push({ index, code: "invalid_timestamp", message: `Row ${index + 1}: timestamp is not valid ISO 8601.` });
      continue;
    }
    if (!Number.isFinite(reading.kwh) || reading.kwh < 0) {
      issues.push({ index, code: "negative_kwh", message: `Row ${index + 1}: kWh must be zero or greater.` });
      continue;
    }
    if (reading.kwh > MAX_INTERVAL_KWH) {
      issues.push({
        index,
        code: "unit_suspected",
        message: `Row ${index + 1}: ${reading.kwh} kWh per interval looks like Wh reported as kWh. Confirm the unit.`,
      });
    }
    if (seen.has(ms)) {
      issues.push({ index, code: "duplicate_timestamp", message: `Row ${index + 1}: duplicate timestamp.` });
      continue;
    }
    seen.add(ms);
    parsed.push({ index, ms, kwh: reading.kwh });
  }

  parsed.sort((a, b) => a.ms - b.ms);
  const gaps: number[] = [];
  for (let i = 1; i < parsed.length; i += 1) {
    const gap = (parsed[i]!.ms - parsed[i - 1]!.ms) / 60_000;
    if (gap > MAX_GAP_MINUTES) {
      gaps.push(gap);
      issues.push({
        index: parsed[i]!.index,
        code: "gap_too_large",
        message: `Row ${parsed[i]!.index + 1}: ${Math.round(gap)} minute gap before this row.`,
      });
    }
  }

  const deltas: number[] = [];
  for (let i = 1; i < parsed.length; i += 1) {
    deltas.push((parsed[i]!.ms - parsed[i - 1]!.ms) / 60_000);
  }
  const intervalMinutes = deltas.length > 0 ? Math.round(median(deltas.filter((d) => d > 0 && d <= MAX_GAP_MINUTES))) : null;

  let expected = 0;
  let covered = 0;
  if (parsed.length > 0 && intervalMinutes && intervalMinutes > 0) {
    const startMs = parsed[0]!.ms;
    const endMs = parsed[parsed.length - 1]!.ms + intervalMinutes * 60_000;
    const slots = Math.round((endMs - startMs) / (intervalMinutes * 60_000));
    expected = slots;
    covered = new Set(parsed.map((row) => Math.round((row.ms - startMs) / (intervalMinutes * 60_000)))).size;
  }
  const missingPct = expected === 0 ? 0 : ((expected - covered) / expected) * 100;
  const coveragePct = Math.max(0, 100 - missingPct);
  if (expected > 0 && missingPct > MAX_COVERAGE_GAP_PCT) {
    issues.push({
      index: -1,
      code: "gap_too_large",
      message: `Coverage is ${coveragePct.toFixed(1)}%; more than ${MAX_COVERAGE_GAP_PCT}% of intervals are missing.`,
    });
  }

  const blocking = issues.some(
    (issue) =>
      issue.code === "invalid_timestamp" ||
      issue.code === "negative_kwh" ||
      issue.code === "duplicate_timestamp" ||
      issue.code === "unit_suspected" ||
      (issue.code === "gap_too_large" && issue.index === -1),
  );

  return {
    ok: !blocking,
    issues,
    rowCount: readings.length,
    duplicateCount: issues.filter((issue) => issue.code === "duplicate_timestamp").length,
    gapCount: gaps.length,
    unitErrorCount: issues.filter((issue) => issue.code === "unit_suspected").length,
    coveragePct,
    totalKwh: parsed.reduce((sum, row) => sum + row.kwh, 0),
    start: parsed.length > 0 ? new Date(parsed[0]!.ms).toISOString() : null,
    end: parsed.length > 0 ? new Date(parsed[parsed.length - 1]!.ms).toISOString() : null,
    intervalMinutes,
  };
}

export interface IntervalEstimateInput {
  readonly readings: readonly IntervalReading[];
  readonly factor?: FactorVersion;
  readonly intensity?: IntensityProfile;
}

/**
 * Interval-timed estimate: recorded consumption per interval times the modelled
 * hourly intensity. Missing intervals inside the coverage threshold are filled
 * with the profile value for that hour.
 */
export function intervalEstimate(input: IntervalEstimateInput): IntervalEstimate {
  const report = validateIntervals(input.readings);
  if (!report.ok) throw new Error("Interval data failed validation");
  const factor = input.factor ?? getActiveFactor();
  const profile = input.intensity ?? buildIntensityProfile();

  const parsed = input.readings
    .map((reading) => ({ start: reading.start, ms: Date.parse(reading.start), kwh: reading.kwh }))
    .filter((row) => !Number.isNaN(row.ms))
    .sort((a, b) => a.ms - b.ms);

  let kgCo2e = 0;
  let kwhTotal = 0;
  for (const row of parsed) {
    const parts = malaysiaParts(new Date(row.ms));
    kgCo2e += row.kwh * intensityAt(profile, parts.month, parts.hour, parts.dayClass);
    kwhTotal += row.kwh;
  }

  if (parsed.length > 0 && report.intervalMinutes) {
    const stepMs = report.intervalMinutes * 60_000;
    const startMs = parsed[0]!.ms;
    const endMs = parsed[parsed.length - 1]!.ms;
    const present = new Set(parsed.map((row) => Math.round((row.ms - startMs) / stepMs)));
    const slots = Math.round((endMs - startMs) / stepMs) + 1;
    const meanKwh = kwhTotal / parsed.length;
    for (let slot = 0; slot < slots; slot += 1) {
      if (present.has(slot)) continue;
      const ms = startMs + slot * stepMs;
      const parts = malaysiaParts(new Date(ms));
      kgCo2e += meanKwh * intensityAt(profile, parts.month, parts.hour, parts.dayClass);
      kwhTotal += meanKwh;
    }
  }

  const flat = kwhTotal * factor.kgPerKwh;
  return {
    kwh: kwhTotal,
    kgCo2e,
    flatKgCo2e: flat,
    deltaKg: kgCo2e - flat,
    coveragePct: report.coveragePct,
    intervalCount: parsed.length,
    factor,
    model: profile.modelVersion,
    label: "Modelled",
  };
}

export interface CsvParseResult {
  readonly ok: boolean;
  readonly readings: readonly IntervalReading[];
  readonly errors: readonly string[];
}

const TIMESTAMP_COLUMNS = ["timestamp", "datetime", "start", "interval_start", "time"];
const KWH_COLUMNS = ["kwh", "kwh_consumed", "consumption_kwh", "usage_kwh", "value"];

function detectColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header.trim().toLowerCase()));
}

/**
 * Accepts a header row with a timestamp column and a kWh column. Rows are
 * validated in full; nothing is partially accepted.
 */
export function parseIntervalCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) return { ok: false, readings: [], errors: ["The file is empty."] };

  const headers = headerLine.split(",").map((value) => value.trim());
  const timeIndex = detectColumn(headers, TIMESTAMP_COLUMNS);
  const kwhIndex = detectColumn(headers, KWH_COLUMNS);
  if (timeIndex === -1 || kwhIndex === -1) {
    return {
      ok: false,
      readings: [],
      errors: ["Expected a header row with a timestamp column and a kWh column."],
    };
  }

  const readings: IntervalReading[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i]!.split(",");
    const rawTime = cells[timeIndex]?.trim();
    const rawKwh = cells[kwhIndex]?.trim();
    if (!rawTime || !rawKwh) {
      errors.push(`Row ${i + 1}: missing timestamp or kWh value.`);
      continue;
    }
    const kwh = Number(rawKwh);
    if (!Number.isFinite(kwh)) {
      errors.push(`Row ${i + 1}: kWh value "${rawKwh}" is not a number.`);
      continue;
    }
    readings.push({ start: rawTime, kwh });
  }

  const validation = validateIntervals(readings);
  for (const issue of validation.issues) {
    if (issue.index === -1) errors.push(issue.message);
  }
  if (readings.length === 0) errors.push("No data rows found.");
  return { ok: errors.length === 0 && validation.ok, readings, errors };
}
