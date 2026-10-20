import { describe, expect, it } from "vitest";
import {
  ghgAdapter,
  electricityAdapter,
  worldBankAdapter,
  openMeteoAdapter,
  domesticShareOf,
  latestObservation,
  coolingDegreeHours,
  radiationByLocalHour,
  runAdapter,
} from "@/adapters/sources";
import { checksum, withFallback } from "@/adapters/contract";
import { GHG_EMISSIONS_ROWS } from "@/adapters/fixtures";

describe("ghg adapter", () => {
  it("drops the net row so aggregates do not double-count or show nulls", async () => {
    const raw = await ghgAdapter.fetch();
    const rows = ghgAdapter.normalize(raw);
    expect(rows.some((row) => row.source === "net")).toBe(false);
    expect(rows.every((row) => Number.isFinite(row.emissionsGg))).toBe(true);
  });

  it("preserves the verified 2023 values", async () => {
    const rows = ghgAdapter.normalize(await ghgAdapter.fetch());
    const total = rows.find((row) => row.year === 2023 && row.source === "total");
    const energy = rows.find((row) => row.year === 2023 && row.source === "energy");
    expect(total?.emissionsGg).toBeCloseTo(361110.6, 1);
    expect(energy?.emissionsGg).toBeCloseTo(285678.59, 2);
  });

  it("validates the normalized set", async () => {
    const rows = ghgAdapter.normalize(await ghgAdapter.fetch());
    expect(ghgAdapter.validate(rows).ok).toBe(true);
  });

  it("rejects an empty payload rather than reporting success", () => {
    expect(ghgAdapter.validate([]).ok).toBe(false);
  });
});

describe("electricity adapter", () => {
  it("normalizes period and sector", async () => {
    const rows = electricityAdapter.normalize(await electricityAdapter.fetch());
    expect(rows[0]).toEqual({ period: "2026-06", sector: "domestic", gwh: 2451.3 });
  });

  it("computes the domestic share for a period", async () => {
    const rows = electricityAdapter.normalize(await electricityAdapter.fetch());
    const share = domesticShareOf(rows, "2026-06");
    expect(share).toBeCloseTo((2451.3 / (2451.3 + 8912.7)) * 100, 4);
  });

  it("returns null for a period with no rows", async () => {
    const rows = electricityAdapter.normalize(await electricityAdapter.fetch());
    expect(domesticShareOf(rows, "2020-01")).toBeNull();
  });
});

describe("world bank adapter", () => {
  it("reads the two-element [meta, rows] response", async () => {
    const rows = worldBankAdapter.normalize(await worldBankAdapter.fetch());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.year).toBe(2023);
    expect(rows[0]?.tonnesPerCapita).toBeCloseTo(8.039, 3);
  });

  it("drops the null 2024 observation and picks 2023 as latest", async () => {
    const rows = worldBankAdapter.normalize(await worldBankAdapter.fetch());
    expect(rows.some((row) => row.year === 2024)).toBe(false);
    expect(latestObservation(rows)?.year).toBe(2023);
    expect(latestObservation(rows)?.tonnesPerCapita).toBeCloseTo(8.039, 3);
  });

  it("survives a malformed payload", () => {
    expect(worldBankAdapter.normalize([{}, []] as never)).toEqual([]);
  });
});

describe("open-meteo adapter", () => {
  it("zips the hourly arrays", async () => {
    const rows = openMeteoAdapter.normalize(await openMeteoAdapter.fetch());
    expect(rows).toHaveLength(6);
    expect(rows[2]?.radiationWm2).toBe(720);
  });

  it("computes cooling degree hours against a 24 °C base", async () => {
    const rows = openMeteoAdapter.normalize(await openMeteoAdapter.fetch());
    expect(coolingDegreeHours(rows)).toBeCloseTo(
      Math.max(0, 26.4 - 24) + Math.max(0, 25.9 - 24) + Math.max(0, 31.8 - 24) +
      Math.max(0, 32.6 - 24) + Math.max(0, 32.1 - 24) + Math.max(0, 28.3 - 24),
      5,
    );
  });

  it("bins radiation by local clock hour", async () => {
    const rows = openMeteoAdapter.normalize(await openMeteoAdapter.fetch());
    const profile = radiationByLocalHour(rows);
    expect(profile).toHaveLength(24);
    expect(profile[12]).toBe(720);
    expect(profile[0]).toBe(0);
  });
});

describe("adapter resilience", () => {
  const fallback = [{ year: 2023, source: "total", emissionsGg: 361110.6 }];

  it("returns live data with a checksum on success", async () => {
    const result = await runAdapter(ghgAdapter, fallback);
    expect(result.run.status).toBe("live");
    expect(result.run.ok).toBe(true);
    expect(result.run.checksum).toHaveLength(16);
  });

  it("returns the cached fallback when fetch throws", async () => {
    const broken = { ...ghgAdapter, fetch: async () => { throw new Error("network down"); } };
    const result = await runAdapter(broken, fallback);
    expect(result.run.status).toBe("cached");
    expect(result.rows).toEqual(fallback);
  });

  it("returns the cached fallback when validation fails", async () => {
    const invalid = { ...ghgAdapter, fetch: async () => [] as never };
    const result = await runAdapter(invalid, fallback);
    expect(result.run.status).toBe("cached");
    expect(result.run.ok).toBe(false);
  });

  it("withFallback never throws", async () => {
    const broken = { ...ghgAdapter, fetch: async () => { throw new Error("boom"); } };
    await expect(withFallback(broken, fallback)).resolves.toMatchObject({ status: "cached" });
  });
});

describe("checksum", () => {
  it("is stable and order-dependent", () => {
    expect(checksum([1, 2, 3])).toBe(checksum([1, 2, 3]));
    expect(checksum([1, 2, 3])).not.toBe(checksum([3, 2, 1]));
  });

  it("differs for different payloads", () => {
    expect(checksum(GHG_EMISSIONS_ROWS)).not.toBe(checksum([{ a: 1 }]));
  });
});
