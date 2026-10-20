import { describe, expect, it } from "vitest";
import { flatEstimate, modelledEstimate, hourlyShares, daysBetween } from "@/domain/carbon/estimates";
import { getActiveFactor } from "@/domain/carbon/factors";
import { roundKg } from "@/domain/carbon/rounding";

const factor = getActiveFactor();
const PERIOD = { periodStart: "2026-09-01", periodEnd: "2026-10-01" };

describe("flat estimate", () => {
  it("matches the 300 kWh golden example", () => {
    expect(roundKg(flatEstimate(300, factor).kgCo2e)).toBe(222.0);
  });

  it("matches the 326 kWh golden example", () => {
    expect(roundKg(flatEstimate(326, factor).kgCo2e)).toBe(241.2);
  });

  it("rejects non-positive and oversized values", () => {
    expect(() => flatEstimate(0, factor)).toThrow();
    expect(() => flatEstimate(-5, factor)).toThrow();
  });

  it("does not round before summation", () => {
    const sum = flatEstimate(1, factor).kgCo2e + flatEstimate(2, factor).kgCo2e;
    expect(sum).toBeCloseTo(3 * factor.kgPerKwh, 10);
  });
});

describe("modelled estimate", () => {
  const modelled = modelledEstimate({ kwh: 300, ...PERIOD, archetype: "ac_evening", factor });

  it("returns a delta against the flat value rather than a replacement", () => {
    expect(modelled.flatKgCo2e).toBeCloseTo(222.0, 5);
    expect(modelled.deltaKg).toBeCloseTo(modelled.kgCo2e - modelled.flatKgCo2e, 8);
  });

  it("is deterministic for identical inputs", () => {
    const repeat = modelledEstimate({ kwh: 300, ...PERIOD, archetype: "ac_evening", factor });
    expect(repeat.kgCo2e).toBe(modelled.kgCo2e);
  });

  it("sums the load shape to the recorded monthly kWh", () => {
    const shares = hourlyShares(PERIOD.periodStart, PERIOD.periodEnd, "ac_evening");
    const total = shares.reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("produces a different result for a different archetype", () => {
    const allDay = modelledEstimate({ kwh: 300, ...PERIOD, archetype: "ac_all_day", factor });
    expect(allDay.kgCo2e).not.toBeCloseTo(modelled.kgCo2e, 5);
  });

  it("flags values above the accepted monthly cap", () => {
    expect(() => modelledEstimate({ kwh: 3001, ...PERIOD, archetype: "mixed", factor })).toThrow();
  });
});

describe("billing periods", () => {
  it("counts a leap-day February correctly", () => {
    expect(daysBetween("2024-02-01", "2024-03-01")).toHaveLength(29);
  });

  it("rejects an inverted period", () => {
    expect(() => daysBetween("2026-10-01", "2026-09-01")).toThrow();
  });

  it("handles a month-end boundary", () => {
    expect(daysBetween("2026-01-31", "2026-02-28")).toHaveLength(28);
  });
});
