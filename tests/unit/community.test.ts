import { describe, expect, it } from "vitest";
import {
  cohortStats,
  coarseBand,
  scenario,
  formatScenario,
  householdTarget,
  eligibleRecords,
  MIN_COHORT_SIZE,
  type CohortRecord,
} from "@/domain/community";
import { getActiveFactor } from "@/domain/carbon/factors";

const factor = getActiveFactor();

function records(count: number, base = 300, overrides: Partial<CohortRecord> = {}): CohortRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    householdId: `h-${index}`,
    kwh: base + index,
    consented: true,
    isDemo: false,
    confirmed: true,
    township: "elmina",
    subzone: "elmina-north",
    ...overrides,
  }));
}

describe("cohort suppression at k = 5", () => {
  it("suppresses a cohort of 4", () => {
    const result = cohortStats(records(4), factor);
    expect(result.suppressed).toBe(true);
    if (result.suppressed) expect(result.reason).toBe("cohort_too_small");
  });

  it("publishes a cohort of 5 with a rounded count", () => {
    const result = cohortStats(records(5), factor);
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.householdCount).toBe(5);
      expect(result.medianKwh).toBeGreaterThan(0);
      expect(result.medianKwh % 5).toBe(0);
    }
  });

  it("uses 5 as the default threshold", () => {
    expect(MIN_COHORT_SIZE).toBe(5);
  });

  it("rounds larger counts to the nearest 5", () => {
    const result = cohortStats(records(128), factor);
    if (!result.suppressed) expect(result.householdCount % 5).toBe(0);
  });

  it("rounds every published value to 5", () => {
    const result = cohortStats(records(37, 302), factor);
    if (!result.suppressed) {
      for (const value of [result.medianKwh, result.p25Kwh, result.p75Kwh, result.p33Kwh, result.p67Kwh]) {
        expect(value % 5).toBe(0);
      }
    }
  });

  it("excludes demo households before counting", () => {
    const mixed = [...records(4), ...records(1, 300, { isDemo: true, householdId: "demo" })];
    expect(eligibleRecords(mixed)).toHaveLength(4);
    expect(cohortStats(mixed, factor).suppressed).toBe(true);
  });

  it("admits demo rows only in the demo namespace", () => {
    const demo = records(12, 300, { isDemo: true });
    expect(eligibleRecords(demo)).toHaveLength(0);
    expect(eligibleRecords(demo, "demo")).toHaveLength(12);
    const result = cohortStats(demo, factor, { namespace: "demo" });
    expect(result.suppressed).toBe(false);
  });

  it("excludes unconsented and unconfirmed rows", () => {
    const mixed = [
      ...records(5),
      ...records(5, 300, { consented: false, householdId: "noconsent" }),
      ...records(5, 300, { confirmed: false, householdId: "noconfirm" }),
    ];
    expect(eligibleRecords(mixed)).toHaveLength(5);
  });

  it("reports no eligible records distinctly", () => {
    const result = cohortStats([], factor);
    expect(result.suppressed).toBe(true);
    if (result.suppressed) expect(result.reason).toBe("no_eligible_records");
  });

  it("respects a custom minimum cohort", () => {
    const result = cohortStats(records(MIN_COHORT_SIZE), factor, { minCohort: 10 });
    expect(result.suppressed).toBe(true);
  });
});

describe("coarse bands", () => {
  const stats = cohortStats(records(100), factor);

  it("returns suppressed when the cohort is suppressed", () => {
    expect(coarseBand(300, cohortStats(records(4), factor))).toBe("suppressed");
  });

  it("assigns lower, middle, and upper thirds", () => {
    if (stats.suppressed) throw new Error("expected published stats");
    expect(coarseBand(stats.p33Kwh - 1, stats)).toBe("lower_third");
    expect(coarseBand(stats.p33Kwh + 1, stats)).toBe("middle_third");
    expect(coarseBand(stats.p67Kwh + 1, stats)).toBe("upper_third");
  });
});

describe("scenario", () => {
  const result = scenario({ households: 200, reductionPct: 10, baselineKwh: 300, factor });

  it("matches the golden community example", () => {
    expect(result.savedKwh).toBe(6000);
    expect(result.savedTonnes).toBeCloseTo(4.44, 2);
    expect(result.annualTonnes).toBeCloseTo(53.28, 2);
  });

  it("labels every output as Scenario", () => {
    expect(result.label).toBe("Scenario");
  });

  it("does not persist or depend on cohort size", () => {
    const withCohort = scenario({ households: 200, reductionPct: 10, baselineKwh: 300, factor, cohortHouseholds: 50 });
    expect(withCohort.savedTonnes).toBe(result.savedTonnes);
    expect(withCohort.exceedsCohort).toBe(true);
  });

  it("clamps out-of-range inputs", () => {
    const clamped = scenario({ households: 99999, reductionPct: 90, baselineKwh: 10, factor });
    expect(clamped.households).toBe(2000);
    expect(clamped.reductionPct).toBe(25);
    expect(clamped.baselineKwh).toBe(150);
  });

  it("formats tonnes to two decimals", () => {
    expect(formatScenario(result).savedTonnes).toBe("4.44 t CO₂e");
    expect(formatScenario(result).annualTonnes).toBe("53.28 t CO₂e");
  });
});

describe("household target (confirmed rule helper)", () => {
  it("is 10% below the trailing median, rounded to 5 kWh", () => {
    expect(householdTarget([300, 300, 300])).toBe(270);
  });

  it("uses the median of an even-length window", () => {
    expect(householdTarget([300, 320])).toBe(280);
  });

  it("returns zero with no history", () => {
    expect(householdTarget([])).toBe(0);
  });
});
