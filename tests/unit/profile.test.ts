import { describe, expect, it } from "vitest";
import {
  DEFAULT_ARCHETYPE,
  QUESTIONNAIRE_VERSION,
  actionApplies,
  airconBand,
  archetypeFor,
  profileBand,
  sizeBand,
  summarise,
  type ProfileAnswers,
} from "@/domain/profile";

const BASE: ProfileAnswers = {
  homeType: "terrace",
  householdSize: 4,
  airconCount: 2,
  occupancy: "out_weekdays",
  coolingHours: "night",
  waterHeating: "tank",
  evCharging: false,
  appliances: ["fridge", "washer", "tv"],
};

describe("archetype mapping", () => {
  it("is deterministic", () => {
    expect(archetypeFor(BASE)).toBe(archetypeFor(BASE));
    expect(archetypeFor(BASE)).toBe("workday_absent");
  });

  it("never assigns a cooling archetype to a home with no aircon", () => {
    const noAircon = { ...BASE, airconCount: 0, coolingHours: "all_day" as const, occupancy: "home_all_day" as const };
    expect(archetypeFor(noAircon)).toBe("mixed");
  });

  it("maps all-day cooling", () => {
    expect(archetypeFor({ ...BASE, coolingHours: "all_day" })).toBe("ac_all_day");
    expect(archetypeFor({ ...BASE, occupancy: "home_all_day" })).toBe("ac_all_day");
  });

  it("maps an evening-only routine", () => {
    expect(archetypeFor({ ...BASE, occupancy: "evenings_only" })).toBe("ac_evening");
  });

  it("falls back to mixed", () => {
    expect(archetypeFor({ ...BASE, occupancy: "varies", coolingHours: "none" })).toBe("mixed");
  });

  it("defaults a missing profile to mixed and labels the source", () => {
    const summary = summarise(null);
    expect(summary.archetype).toBe(DEFAULT_ARCHETYPE);
    expect(summary.source).toBe("default");
    expect(summary.band).toBeNull();
    expect(summary.version).toBeNull();
  });

  it("carries the questionnaire version for an answered profile", () => {
    const summary = summarise({ ...BASE, version: QUESTIONNAIRE_VERSION, completedAt: "2026-10-01T00:00:00Z" });
    expect(summary.source).toBe("answered");
    expect(summary.version).toBe(QUESTIONNAIRE_VERSION);
  });
});

describe("profile band", () => {
  it("bands household size at the documented boundaries", () => {
    expect(sizeBand(1)).toBe("1-2");
    expect(sizeBand(2)).toBe("1-2");
    expect(sizeBand(3)).toBe("3-4");
    expect(sizeBand(4)).toBe("3-4");
    expect(sizeBand(5)).toBe("5+");
    expect(sizeBand(9)).toBe("5+");
  });

  it("bands aircon count at the documented boundaries", () => {
    expect(airconBand(0)).toBe("0");
    expect(airconBand(1)).toBe("1-2");
    expect(airconBand(2)).toBe("1-2");
    expect(airconBand(3)).toBe("3+");
  });

  it("builds a stable composite key", () => {
    expect(profileBand({ homeType: "apartment", householdSize: 2, airconCount: 0 }).key).toBe("apartment|1-2|0");
  });
});

describe("action applicability", () => {
  it("removes cooling actions when there are no aircons", () => {
    const noAircon = { ...BASE, airconCount: 0, coolingHours: "none" as const };
    expect(actionApplies("temperature", noAircon)).toBe(false);
    expect(actionApplies("timer", noAircon)).toBe(false);
    expect(actionApplies("ac-servicing", noAircon)).toBe(false);
    expect(actionApplies("led", noAircon)).toBe(true);
  });

  it("requires overnight cooling for the sleep timer", () => {
    expect(actionApplies("timer", { ...BASE, coolingHours: "evening" })).toBe(false);
    expect(actionApplies("timer", { ...BASE, coolingHours: "night" })).toBe(true);
  });

  it("only offers the tank action to tank owners", () => {
    expect(actionApplies("water-heater", BASE)).toBe(true);
    expect(actionApplies("water-heater", { ...BASE, waterHeating: "instant" })).toBe(false);
  });

  it("offers EV charging only when the resident charges at home", () => {
    expect(actionApplies("ev-offpeak", BASE)).toBe(false);
    expect(actionApplies("ev-offpeak", { ...BASE, evCharging: true })).toBe(true);
  });

  it("is permissive when the appliance list is unknown", () => {
    const unknown = { ...BASE, appliances: [] as ProfileAnswers["appliances"] };
    expect(actionApplies("standby", unknown)).toBe(true);
    expect(actionApplies("fridge-clearance", unknown)).toBe(true);
  });

  it("is permissive with no profile at all", () => {
    expect(actionApplies("temperature", null)).toBe(true);
  });
});
