import { describe, expect, it } from "vitest";
import {
  validateIntervals,
  intervalEstimate,
  parseIntervalCsv,
  MAX_INTERVAL_KWH,
} from "@/domain/carbon/interval";
import { getActiveFactor } from "@/domain/carbon/factors";

const factor = getActiveFactor();

function series(startIso: string, count: number, kwh = 0.3, stepMinutes = 30) {
  const start = Date.parse(startIso);
  return Array.from({ length: count }, (_, index) => ({
    start: new Date(start + index * stepMinutes * 60_000).toISOString(),
    kwh,
  }));
}

describe("interval validation", () => {
  it("accepts a clean half-hourly series", () => {
    const report = validateIntervals(series("2026-09-01T00:00:00Z", 48));
    expect(report.ok).toBe(true);
    expect(report.duplicateCount).toBe(0);
    expect(report.coveragePct).toBeCloseTo(100, 5);
    expect(report.intervalMinutes).toBe(30);
  });

  it("reports duplicate timestamps and refuses to save", () => {
    const readings = series("2026-09-01T00:00:00Z", 4);
    readings.push({ start: readings[1]!.start, kwh: 0.2 });
    const report = validateIntervals(readings);
    expect(report.ok).toBe(false);
    expect(report.duplicateCount).toBe(1);
  });

  it("blocks a probable Wh-as-kWh unit error", () => {
    const readings = series("2026-09-01T00:00:00Z", 4);
    readings[1] = { start: readings[1]!.start, kwh: MAX_INTERVAL_KWH + 1 };
    const report = validateIntervals(readings);
    expect(report.ok).toBe(false);
    expect(report.unitErrorCount).toBe(1);
  });

  it("rejects negative readings", () => {
    const readings = [{ start: "2026-09-01T00:00:00Z", kwh: -1 }];
    expect(validateIntervals(readings).ok).toBe(false);
  });

  it("rejects unparseable timestamps", () => {
    const readings = [{ start: "not-a-date", kwh: 0.3 }];
    expect(validateIntervals(readings).ok).toBe(false);
  });

  it("flags a gap larger than two hours", () => {
    const readings = [
      { start: "2026-09-01T00:00:00Z", kwh: 0.3 },
      { start: "2026-09-01T04:00:00Z", kwh: 0.3 },
    ];
    const report = validateIntervals(readings);
    expect(report.gapCount).toBe(1);
  });

  it("suppresses coverage below 98%", () => {
    const readings = series("2026-09-01T00:00:00Z", 40);
    readings.splice(10, 10);
    const report = validateIntervals(readings);
    expect(report.coveragePct).toBeLessThan(98);
    expect(report.ok).toBe(false);
  });
});

describe("interval estimate", () => {
  it("pairs recorded consumption with the modelled intensity", () => {
    const readings = series("2026-09-01T00:00:00Z", 48);
    const result = intervalEstimate({ readings, factor });
    expect(result.label).toBe("Modelled");
    expect(result.kwh).toBeCloseTo(14.4, 5);
    expect(result.coveragePct).toBeCloseTo(100, 5);
    expect(result.kgCo2e).toBeGreaterThan(0);
    expect(result.flatKgCo2e).toBeCloseTo(result.kwh * factor.kgPerKwh, 6);
  });

  it("throws rather than silently accepting invalid rows", () => {
    expect(() => intervalEstimate({ readings: [{ start: "nope", kwh: 1 }], factor })).toThrow();
  });
});

describe("CSV parsing", () => {
  it("accepts a header with timestamp and kwh", () => {
    const csv = `timestamp,kwh\n2026-09-01T00:00:00+08:00,0.3\n2026-09-01T00:30:00+08:00,0.31`;
    const result = parseIntervalCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.readings).toHaveLength(2);
  });

  it("rejects a file without the expected columns", () => {
    const result = parseIntervalCsv("a,b\n1,2");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/header row/i);
  });

  it("reports a non-numeric kWh cell", () => {
    const result = parseIntervalCsv("timestamp,kwh\n2026-09-01T00:00:00Z,abc");
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/not a number/);
  });

  it("accepts an empty file gracefully", () => {
    expect(parseIntervalCsv("").ok).toBe(false);
  });
});
