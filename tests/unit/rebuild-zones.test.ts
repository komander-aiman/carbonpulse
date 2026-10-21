import { describe, expect, it } from "vitest";
import { rebuildZones } from "@/lib/rebuild-zones";

/**
 * The rebuild job must use the same k gate and rounding as the read path. These
 * assertions run against the in-memory store, so `persisted` is false and no
 * database is touched.
 */
describe("rebuild-zones job", () => {
  it("reports the k threshold and every zone's decision", async () => {
    const report = await rebuildZones("2026-09-01", { persist: false });
    expect(report.kThreshold).toBe(5);
    expect(report.period).toBe("2026-09-01");
    expect(report.zones).toHaveLength(6);
    expect(report.zones.every((zone) => ["elmina-north", "elmina-central", "elmina-west", "elmina-east", "elmina-south", "elmina-lake"].includes(zone.zoneId))).toBe(true);
    expect(report.persisted).toBe(false);
  });

  it("never publishes a count below k", async () => {
    const report = await rebuildZones("2026-09-01", { persist: false });
    for (const zone of report.zones) {
      if (zone.suppressed) {
        expect(zone.householdCount).toBeNull();
        expect(zone.sharedProgressPct).toBeNull();
      } else {
        expect(zone.householdCount).not.toBeNull();
        expect((zone.householdCount ?? 0) % 5).toBe(0);
        expect(zone.householdCount ?? 0).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("is deterministic for the same period", async () => {
    const first = await rebuildZones("2026-09-01", { persist: false });
    const second = await rebuildZones("2026-09-01", { persist: false });
    expect(second.zones).toEqual(first.zones);
  });
});
