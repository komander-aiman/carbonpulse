import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  ensureHousehold,
  getHousehold,
  saveUsage,
  setActionState,
} from "@/lib/household-store";

function newHousehold(): string {
  const id = `test-${randomUUID()}`;
  ensureHousehold(id, false);
  return id;
}

describe("immutable stored estimates", () => {
  it("captures factor and model versions when the bill is confirmed", () => {
    const id = newHousehold();
    const result = saveUsage(id, {
      periodStart: "2026-04-01",
      periodEnd: "2026-05-01",
      kwh: 300,
      source: "manual",
    });
    expect(result.ok).toBe(true);
    const record = getHousehold(id)?.usage[0];
    expect(record?.estimate).not.toBeNull();
    expect(record?.estimate?.factorId).toBe("peninsular-2024-provisional");
    expect(record?.estimate?.flatKg).toBeCloseTo(222, 5);
    expect(record?.estimate?.modelId).toContain("diurnal");
    // The factor is stored with the value so a later update cannot rewrite it.
    expect(record?.estimate?.factorKgPerKwh).toBeCloseTo(0.74, 5);
  });

  it("keeps an earlier stored estimate unchanged when a later bill is added", () => {
    const id = newHousehold();
    saveUsage(id, {
      periodStart: "2026-04-01",
      periodEnd: "2026-05-01",
      kwh: 300,
      source: "manual",
    });
    const before = getHousehold(id)?.usage[0]?.estimate;
    saveUsage(id, {
      periodStart: "2026-05-01",
      periodEnd: "2026-06-01",
      kwh: 200,
      source: "manual",
    });
    const after = getHousehold(id)?.usage[0]?.estimate;
    expect(after).toEqual(before);
  });
});

describe("recorded goal milestones", () => {
  it("records one milestone for a new bill that meets the prior goal", () => {
    const id = newHousehold();
    saveUsage(id, {
      periodStart: "2026-04-01",
      periodEnd: "2026-05-01",
      kwh: 300,
      source: "manual",
    });
    expect(getHousehold(id)?.milestones).toHaveLength(0);

    // Provisional goal from 300 is 270, so 260 meets it.
    saveUsage(id, {
      periodStart: "2026-05-01",
      periodEnd: "2026-06-01",
      kwh: 260,
      source: "manual",
    });
    const milestones = getHousehold(id)?.milestones ?? [];
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.goalKwh).toBe(270);
    expect(milestones[0]?.label).toBe("Provisional");
    expect(milestones[0]?.achievedKwh).toBe(260);
  });

  it("does not invent a milestone for the seeded history", () => {
    const id = newHousehold();
    saveUsage(id, {
      periodStart: "2026-04-01",
      periodEnd: "2026-05-01",
      kwh: 300,
      source: "manual",
    });
    saveUsage(id, {
      periodStart: "2026-05-01",
      periodEnd: "2026-06-01",
      kwh: 320,
      source: "manual",
    });
    expect(getHousehold(id)?.milestones).toHaveLength(0);
  });
});

describe("action completion and undo", () => {
  it("keeps a completion timestamp while done and removes it on undo", () => {
    const id = newHousehold();
    setActionState(id, "led", "done");
    const done = getHousehold(id)?.actions.find((action) => action.actionId === "led");
    expect(done?.state).toBe("done");
    expect(done?.updatedAt).toBeTruthy();

    setActionState(id, "led", "suggested");
    const undone = getHousehold(id)?.actions.find((action) => action.actionId === "led");
    expect(undone?.state).toBe("suggested");
  });
});
