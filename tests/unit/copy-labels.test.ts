import { describe, expect, it } from "vitest";
import { comparisonCopy, bandLabel, bandFromKey, type Comparison } from "@/domain/comparison";
import { zoneLabel, zoneStats } from "@/domain/zone";
import { getActiveFactor } from "@/domain/carbon/factors";
import { sharedGoal, sharedGoalCopy } from "@/domain/shared-goal";
import { householdGoal } from "@/domain/goal";
import { HOME_TYPE_LABELS, OCCUPANCY_LABELS, COOLING_LABELS, WATER_HEATING_LABELS, APPLIANCE_LABELS } from "@/domain/profile";

const factor = getActiveFactor();

describe("copy and labels", () => {
  it("labels every zone", () => {
    expect(zoneLabel("elmina-north")).toBe("Elmina North");
    expect(zoneLabel("elmina-lake")).toBe("Elmina Lake");
    expect(zoneLabel("something-else")).toBe("something-else");
  });

  it("labels every coarse band", () => {
    expect(bandLabel("lower_third")).toContain("Lower third");
    expect(bandLabel("middle_third")).toContain("Middle third");
    expect(bandLabel("upper_third")).toContain("Upper third");
    expect(bandLabel("suppressed")).toBe("Not enough data yet");
  });

  it("renders tier-specific comparison copy", () => {
    const base = {
      suppressed: false as const,
      tier: "T1" as const,
      tierLabel: "Similar homes in your zone",
      groupN: 5,
      medianKwh: 300,
      p33Kwh: 280,
      p67Kwh: 320,
      band: "middle_third" as const,
      differenceKwh: -20,
      differenceKg: -14.8,
    };
    expect(comparisonCopy(base)).toContain("20 kWh less");
    expect(comparisonCopy({ ...base, tier: "T2", tierLabel: "Households in your zone" })).toContain(
      "could not find 5 homes",
    );
    expect(comparisonCopy({ ...base, tier: "T3", tierLabel: "Households in City of Elmina" })).toContain(
      "City of Elmina",
    );
  });

  it("describes more-than and less-than without judgement", () => {
    const result: Comparison = {
      suppressed: false,
      tier: "T1",
      tierLabel: "Similar homes in your zone",
      groupN: 5,
      medianKwh: 300,
      p33Kwh: 280,
      p67Kwh: 320,
      band: "upper_third",
      differenceKwh: 40,
      differenceKg: 29.6,
    };
    const copy = comparisonCopy(result);
    expect(copy).toContain("40 kWh more");
    expect(copy).toContain("not a rating");
    expect(copy).not.toMatch(/better|worse|efficient/i);
  });

  it("parses a band key back to its parts", () => {
    expect(bandFromKey("apartment|1-2|0")).toEqual({
      homeType: "apartment",
      sizeBand: "1-2",
      airconBand: "0",
      key: "apartment|1-2|0",
    });
    expect(bandFromKey("garbage")).toBeNull();
  });

  it("has a label for every questionnaire option", () => {
    for (const labels of [HOME_TYPE_LABELS, OCCUPANCY_LABELS, COOLING_LABELS, WATER_HEATING_LABELS, APPLIANCE_LABELS]) {
      for (const value of Object.values(labels)) expect(value.length).toBeGreaterThan(2);
    }
  });
});

describe("shared goal edge cases", () => {
  const records = Array.from({ length: 5 }, (_, index) => ({
    householdId: `z-${index}`,
    kwh: 300,
    consented: true,
    isDemo: false,
    confirmed: true,
    township: "elmina",
    subzone: "elmina-north",
  }));
  const zone = zoneStats("elmina-north", records, factor);

  it("is suppressed when the target is not below the reference", () => {
    const goals = Array.from({ length: 5 }, () => householdGoal([300])).filter((goal) => goal !== null);
    const result = sharedGoal({
      zoneId: "elmina-north",
      goals: Array.from({ length: 5 }, () => ({ ...goals[0]!, kwh: 330 })),
      referenceKwh: [300, 300, 300, 300, 300],
      currentKwh: [300, 300, 300, 300, 300],
      zone,
    });
    expect(result.suppressed).toBe(true);
  });

  it("writes copy for progress and for above-goal", () => {
    const goals = Array.from({ length: 5 }, () => householdGoal([250])).filter((goal) => goal !== null);
    const goalResult = sharedGoal({
      zoneId: "elmina-north",
      goals,
      referenceKwh: [300, 300, 300, 300, 300],
      currentKwh: [260, 260, 260, 260, 260],
      zone,
    });
    expect(sharedGoalCopy(goalResult)).toContain("Shared goal");

    const above = sharedGoal({
      zoneId: "elmina-north",
      goals,
      referenceKwh: [300, 300, 300, 300, 300],
      currentKwh: [340, 340, 340, 340, 340],
      zone,
    });
    expect(sharedGoalCopy(above)).toContain("Above the shared goal");
  });
});
