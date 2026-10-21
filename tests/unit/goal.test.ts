import { describe, expect, it } from "vitest";
import { householdGoal, goalCopy } from "@/domain/goal";

describe("goal rule (D18)", () => {
  it("has no goal without a confirmed period", () => {
    expect(householdGoal([])).toBeNull();
  });

  it("is provisional from the latest period only at one bill", () => {
    const goal = householdGoal([326]);
    expect(goal?.rule).toBe("provisional");
    expect(goal?.label).toBe("Provisional");
    expect(goal?.kwh).toBe(295);
    expect(goal?.basisPeriods).toBe(1);
  });

  it("stays provisional at two bills and ignores the older period", () => {
    const goal = householdGoal([300, 326]);
    expect(goal?.rule).toBe("provisional");
    expect(goal?.kwh).toBe(295);
    expect(goal?.basisPeriods).toBe(2);
  });

  it("becomes confirmed at three bills using the trailing median", () => {
    const goal = householdGoal([300, 326, 310]);
    expect(goal?.rule).toBe("confirmed");
    expect(goal?.label).toBe("Confirmed");
    expect(goal?.kwh).toBe(280);
    expect(goal?.basisPeriods).toBe(3);
  });

  it("trails only the three most recent periods", () => {
    const goal = householdGoal([100, 300, 326, 310, 280]);
    expect(goal?.kwh).toBe(280);
  });

  it("rounds to the nearest 5 kWh", () => {
    expect(householdGoal([333])?.kwh).toBe(300);
    expect(householdGoal([301])?.kwh).toBe(270);
  });

  it("ignores non-positive and non-finite values", () => {
    expect(householdGoal([0, Number.NaN, 300])?.basisPeriods).toBe(1);
    expect(householdGoal([0])).toBeNull();
  });

  it("writes different copy for provisional and confirmed goals", () => {
    expect(goalCopy(householdGoal([300]))).toContain("Provisional");
    expect(goalCopy(householdGoal([300, 300, 300]))).toContain("Confirmed");
    expect(goalCopy(null)).toContain("Add a confirmed bill");
  });
});
