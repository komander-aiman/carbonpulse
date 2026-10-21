import { describe, expect, it } from "vitest";
import { getActiveFactor } from "@/domain/carbon/factors";
import { zoneBand, zoneStats, SUPPRESSION_COPY } from "@/domain/zone";
import type { CohortRecord } from "@/domain/community";

const factor = getActiveFactor();

function record(index: number, kwh: number, overrides: Partial<CohortRecord> = {}): CohortRecord {
  return {
    householdId: `h-${index}`,
    kwh,
    consented: true,
    isDemo: false,
    confirmed: true,
    township: "elmina",
    subzone: "elmina-north",
    ...overrides,
  };
}

function zoneRecords(count: number, base = 300): CohortRecord[] {
  return Array.from({ length: count }, (_, index) => record(index, base + index * 10));
}

describe("zone aggregate at k = 5", () => {
  it("suppresses four homes and publishes five", () => {
    const four = zoneStats("elmina-north", zoneRecords(4), factor);
    expect(four.suppressed).toBe(true);
    const five = zoneStats("elmina-north", zoneRecords(5), factor);
    expect(five.suppressed).toBe(false);
  });

  it("reports the suppression copy consistently", () => {
    expect(SUPPRESSION_COPY).toBe("Not enough data yet");
  });

  it("only reads the requested zone", () => {
    const records = [...zoneRecords(5), ...zoneRecords(5).map((row, index) => ({ ...row, householdId: `e-${index}`, subzone: "elmina-east" }))];
    const north = zoneStats("elmina-north", records, factor);
    expect(north.suppressed).toBe(false);
    if (!north.suppressed) expect(north.householdCount).toBe(5);
  });

  it("rounds every published value to 5", () => {
    const result = zoneStats("elmina-north", zoneRecords(37, 302), factor);
    if (result.suppressed) throw new Error("expected published zone");
    for (const value of [
      result.householdCount,
      result.medianKwh,
      result.p25Kwh,
      result.p75Kwh,
      result.p33Kwh,
      result.p67Kwh,
    ]) {
      expect(value % 5).toBe(0);
    }
  });

  it("never exposes a mean", () => {
    const result = zoneStats("elmina-north", zoneRecords(10), factor);
    expect(Object.keys(result)).not.toContain("meanKwh");
    expect(Object.keys(result)).not.toContain("mean");
  });

  it("excludes demo rows from the real namespace", () => {
    const records = zoneRecords(5).map((row) => ({ ...row, isDemo: true }));
    expect(zoneStats("elmina-north", records, factor).suppressed).toBe(true);
    expect(zoneStats("elmina-north", records, factor, { namespace: "demo" }).suppressed).toBe(false);
  });

  it("excludes unconsented rows", () => {
    const records = zoneRecords(6).map((row) => ({ ...row, consented: false }));
    expect(zoneStats("elmina-north", records, factor).suppressed).toBe(true);
  });

  it("assigns thirds from the published edges", () => {
    const result = zoneStats("elmina-north", zoneRecords(20), factor);
    if (result.suppressed) throw new Error("expected published zone");
    expect(zoneBand(result.p33Kwh - 1, result)).toBe("lower_third");
    expect(zoneBand(result.p67Kwh + 1, result)).toBe("upper_third");
    expect(zoneBand(result.p33Kwh + 1, result)).toBe("middle_third");
  });

  it("returns suppressed band for a suppressed zone", () => {
    expect(zoneBand(300, zoneStats("elmina-north", zoneRecords(3), factor))).toBe("suppressed");
  });
});
