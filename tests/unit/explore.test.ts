import { describe, expect, it } from "vitest";
import { buildExploreModel } from "@/domain/explore";
import { getActiveFactor } from "@/domain/carbon/factors";
import type { ProfileAnswers } from "@/domain/profile";

const factor = getActiveFactor();

const BASE: ProfileAnswers = {
  homeType: "terrace",
  householdSize: 4,
  airconCount: 2,
  occupancy: "evenings_only",
  coolingHours: "evening",
  waterHeating: "tank",
  evCharging: false,
  appliances: ["fridge", "washer", "tv", "console"],
};

function ids(profile: ProfileAnswers | null, areaId: string): string[] {
  const area = buildExploreModel({ profile, factor }).areas.find((entry) => entry.id === areaId);
  return area?.actions.map((action) => action.id) ?? [];
}

describe("explore model", () => {
  it("groups the ranked catalog by room without inventing room totals", () => {
    const model = buildExploreModel({ profile: BASE, factor });
    expect(model.areas.map((area) => area.id)).toEqual([
      "bedroom",
      "living",
      "kitchen",
      "bathroom",
      "lighting",
    ]);
    expect(ids(BASE, "bedroom")).toContain("temperature");
    expect(ids(BASE, "bedroom")).toContain("ac-servicing");
    expect(ids(BASE, "living")).toEqual(["standby"]);
    expect(ids(BASE, "bathroom")).toEqual(["water-heater"]);
    expect(ids(BASE, "kitchen")).toContain("appliance-schedule");
    expect(ids(BASE, "kitchen")).toContain("fridge-clearance");
    expect(ids(BASE, "lighting")).toEqual(["led"]);
    // Every room only exposes action ranges; there is no consumption field.
    for (const area of model.areas) {
      for (const action of area.actions) {
        expect(action).not.toHaveProperty("kwhShare");
        expect(action).not.toHaveProperty("roomKwh");
        expect(action).not.toHaveProperty("percent");
      }
    }
  });

  it("applies the profile filter and keeps the same factor conversion", () => {
    const noAircon: ProfileAnswers = { ...BASE, airconCount: 0, coolingHours: "none", waterHeating: "instant" };
    const model = buildExploreModel({ profile: noAircon, factor });
    const bedroom = model.areas.find((area) => area.id === "bedroom")!;
    const bathroom = model.areas.find((area) => area.id === "bathroom")!;
    expect(bedroom.actions).toHaveLength(0);
    expect(bedroom.emptyTitle).toBe("No cooling action for this home");
    expect(bathroom.actions).toHaveLength(0);
    expect(bathroom.emptyBody).toContain("instant heater");

    const lighting = model.areas.find((area) => area.id === "lighting")!;
    for (const action of lighting.actions) {
      expect(action.kgLow).toBeCloseTo(Math.round(action.kwhLow * factor.kgPerKwh * 10) / 10, 5);
    }
  });

  it("falls back to general mixed guidance when the profile is missing", () => {
    const model = buildExploreModel({ profile: null, factor });
    expect(model.tailored).toBe(false);
    expect(model.archetype).toBe("mixed");
    expect(model.actionCount).toBeGreaterThan(0);
    expect(ids(null, "lighting")).toEqual(["led"]);
    // With no answers, cooling remains available as general guidance.
    expect(ids(null, "bedroom")).toContain("temperature");
  });

  it("carries the persisted action state without changing the catalog", () => {
    const model = buildExploreModel({
      profile: BASE,
      factor,
      actionStates: [{ actionId: "standby", state: "done" }],
    });
    const standby = model.areas.find((area) => area.id === "living")!.actions[0]!;
    expect(standby.id).toBe("standby");
    expect(standby.state).toBe("done");
  });

  it("mirrors a dismissed action only when it empties the room", () => {
    const livingDismissed = buildExploreModel({
      profile: BASE,
      factor,
      actionStates: [{ actionId: "standby", state: "dismissed" }],
    });
    const living = livingDismissed.areas.find((area) => area.id === "living")!;
    expect(living.actions).toHaveLength(0);
    expect(living.emptyTitle).toBe("Every action in this room is set aside");

    const kitchenDismissed = buildExploreModel({
      profile: BASE,
      factor,
      actionStates: [{ actionId: "fridge-clearance", state: "dismissed" }],
    });
    const kitchen = kitchenDismissed.areas.find((area) => area.id === "kitchen")!;
    expect(kitchen.actions.map((action) => action.id)).not.toContain("fridge-clearance");
    expect(kitchen.actions.map((action) => action.id)).toContain("appliance-schedule");
  });
});
