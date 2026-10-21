import { describe, expect, it } from "vitest";
import { getActiveFactor } from "@/domain/carbon/factors";
import { comparisonCopy, compareWithSimilarHomes, TIER_LABELS, type ComparableHousehold } from "@/domain/comparison";
import { zoneStats } from "@/domain/zone";
import { householdGoal } from "@/domain/goal";
import { sharedGoal, sharedGoalCopy } from "@/domain/shared-goal";
import type { CohortRecord } from "@/domain/community";

const factor = getActiveFactor();

function comparable(
  index: number,
  overrides: Partial<ComparableHousehold> = {},
): ComparableHousehold {
  return {
    householdId: `h-${index}`,
    kwh: 300,
    consented: true,
    isDemo: false,
    confirmed: true,
    township: "elmina",
    subzone: "elmina-central",
    bandKey: "apartment|1-2|0",
    ...overrides,
  };
}

function viewer(kwh = 320) {
  return {
    householdId: "viewer",
    kwh,
    subzone: "elmina-central",
    township: "elmina",
    bandKey: "apartment|1-2|0",
  };
}

describe("similar-home tier ladder", () => {
  it("uses T1 when five band matches exist", () => {
    const records = [...Array.from({ length: 5 }, (_, i) => comparable(i)), comparable(99, { householdId: "other", subzone: "elmina-north" })];
    const result = compareWithSimilarHomes({ viewer: viewer(), records, factor });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.tier).toBe("T1");
      expect(result.tierLabel).toBe(TIER_LABELS.T1);
    }
  });

  it("falls back to T2 when the band group is four and the zone has twelve", () => {
    // Three band matches plus the viewer is four; the zone tier is large enough.
    const band = Array.from({ length: 3 }, (_, i) => comparable(i));
    const zoneOnly = Array.from({ length: 8 }, (_, i) => comparable(10 + i, { bandKey: "terrace|3-4|1-2" }));
    const result = compareWithSimilarHomes({ viewer: viewer(), records: [...band, ...zoneOnly], factor });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) expect(result.tier).toBe("T2");
  });

  it("falls back to T3 when neither the band nor the zone reaches 5", () => {
    const band = Array.from({ length: 3 }, (_, i) => comparable(i));
    const elsewhere = Array.from({ length: 8 }, (_, i) =>
      comparable(10 + i, { subzone: "elmina-lake", bandKey: "terrace|3-4|1-2" }),
    );
    const result = compareWithSimilarHomes({ viewer: viewer(), records: [...band, ...elsewhere], factor });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) expect(result.tier).toBe("T3");
  });

  it("suppresses when no tier reaches five, with the viewer included", () => {
    // Three others plus the viewer is four: below k.
    const records = Array.from({ length: 3 }, (_, i) => comparable(i));
    const result = compareWithSimilarHomes({ viewer: viewer(), records, factor });
    expect(result.suppressed).toBe(true);
    if (result.suppressed) expect(result.minimumGroup).toBe(5);
    expect(comparisonCopy(result)).toContain("Not enough data yet");
  });

  it("counts the viewer in their own group", () => {
    // Four other homes plus the viewer is exactly five.
    const records = Array.from({ length: 4 }, (_, i) => comparable(i));
    const result = compareWithSimilarHomes({ viewer: viewer(), records, factor });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) expect(result.groupN).toBe(5);
  });

  it("suppresses when the viewer has no profile", () => {
    const records = Array.from({ length: 12 }, (_, i) => comparable(i));
    const result = compareWithSimilarHomes({
      viewer: { ...viewer(), bandKey: null },
      records,
      factor,
    });
    expect(result.suppressed).toBe(true);
    if (result.suppressed) expect(result.reason).toBe("no_profile");
    expect(comparisonCopy(result)).toContain("Add your household profile");
  });

  it("never exposes a mean or an individual value", () => {
    const records = Array.from({ length: 6 }, (_, i) => comparable(i));
    const result = compareWithSimilarHomes({ viewer: viewer(), records, factor });
    expect(Object.keys(result)).not.toContain("meanKwh");
    expect(JSON.stringify(result)).not.toContain("householdId");
  });

  it("never mixes demo rows into a real tier", () => {
    const demo = Array.from({ length: 8 }, (_, i) => comparable(i, { isDemo: true }));
    const result = compareWithSimilarHomes({ viewer: viewer(), records: demo, factor, namespace: "real" });
    expect(result.suppressed).toBe(true);
  });

  it("rounds the group size and difference to five", () => {
    const records = Array.from({ length: 7 }, (_, i) => comparable(i));
    const result = compareWithSimilarHomes({ viewer: viewer(), records, factor });
    if (result.suppressed) throw new Error("expected published comparison");
    expect(result.groupN % 5).toBe(0);
    expect(result.differenceKwh % 5).toBe(0);
  });
});

describe("shared goal", () => {
  function cohort(count: number): CohortRecord[] {
    return Array.from({ length: count }, (_, i) => ({
      householdId: `s-${i}`,
      kwh: 300 + i,
      consented: true,
      isDemo: false,
      confirmed: true,
      township: "elmina",
      subzone: "elmina-north",
    }));
  }

  const zone = zoneStats("elmina-north", cohort(5), factor);

  it("matches the worked example", () => {
    const goals = Array.from({ length: 5 }, () => householdGoal([278])).filter((goal) => goal !== null);
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals,
      referenceKwh: [300, 300, 300, 300, 310],
      currentKwh: [290, 290, 290, 290, 290],
      zone,
    });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.referenceKwh).toBe(1510);
      expect(result.targetKwh).toBe(1250);
      expect(result.progressPct).toBeGreaterThanOrEqual(0);
      expect(result.progressPct).toBeLessThanOrEqual(100);
    }
  });

  it("clamps progress to zero when the current period is above the reference", () => {
    const goals = Array.from({ length: 5 }, () => householdGoal([250])).filter((goal) => goal !== null);
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals,
      referenceKwh: [300, 300, 300, 300, 300],
      currentKwh: [400, 400, 400, 400, 400],
      zone,
    });
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.progressPct).toBe(0);
      expect(result.aboveGoal).toBe(true);
    }
  });

  it("clamps progress to 100 when the target is reached", () => {
    const goals = Array.from({ length: 5 }, () => householdGoal([250])).filter((goal) => goal !== null);
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals,
      referenceKwh: [300, 300, 300, 300, 300],
      currentKwh: [200, 200, 200, 200, 200],
      zone,
    });
    if (result.suppressed) throw new Error("expected a shared goal");
    expect(result.progressPct).toBe(100);
  });

  it("is suppressed when the zone is suppressed", () => {
    const suppressedZone = zoneStats("elmina-north", cohort(3), factor);
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals: [householdGoal([300])!],
      referenceKwh: [300],
      currentKwh: [300],
      zone: suppressedZone,
    });
    expect(result.suppressed).toBe(true);
    expect(sharedGoalCopy(result)).toBe("Not enough data yet");
  });

  it("is suppressed when no household has a goal", () => {
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals: [],
      referenceKwh: [300],
      currentKwh: [300],
      zone,
    });
    expect(result.suppressed).toBe(true);
  });
});
