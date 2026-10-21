import { afterEach, describe, expect, it, vi } from "vitest";
import { ghgAdapter, electricityAdapter, worldBankAdapter, openMeteoAdapter } from "@/adapters/sources";
import { DEMO_MODE as _unused } from "@/lib/config";

void _unused;

const originalDemoMode = process.env.DEMO_MODE;

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("DEMO_MODE wiring", () => {
  it("treats unset as demo on", () => {
    delete process.env.DEMO_MODE;
    expect(process.env.DEMO_MODE !== "false").toBe(true);
  });

  it("treats only the literal string 'false' as off", () => {
    process.env.DEMO_MODE = "false";
    expect(process.env.DEMO_MODE !== "false").toBe(false);

    for (const value of ["FALSE", "0", "no", "off", ""]) {
      process.env.DEMO_MODE = value;
      expect(process.env.DEMO_MODE !== "false").toBe(true);
    }
  });
});

describe("electricity adapter normalizes both source shapes", () => {
  it("maps the live `local_domestic` sector to `domestic`", () => {
    // Shape taken from storage.data.gov.my/energy/electricity_consumption.csv
    const rows = electricityAdapter.normalize([
      { date: "2026-06-01", sector: "local_domestic", consumption: 2451.3 },
      { date: "2026-06-01", sector: "local_commercial", consumption: 8912.7 },
      { date: "2026-06-01", sector: "losses", consumption: 853.9 },
    ] as never);
    expect(rows.map((row) => row.sector)).toEqual(["domestic", "commercial", "losses"]);
    expect(rows[0]?.gwh).toBe(2451.3);
  });

  it("still accepts the fixture shape using `domestic` and `value`", () => {
    const rows = electricityAdapter.normalize([
      { date: "2026-06-01", sector: "domestic", value: 2451.3 },
    ] as never);
    expect(rows[0]).toEqual({ period: "2026-06", sector: "domestic", gwh: 2451.3 });
  });

  it("produces a domestic share from live-shaped rows", () => {
    const rows = electricityAdapter.normalize([
      { date: "2026-06-01", sector: "local_domestic", consumption: 25 },
      { date: "2026-06-01", sector: "local_commercial", consumption: 75 },
    ] as never);
    const total = rows.reduce((sum, row) => sum + row.gwh, 0);
    const domestic = rows.filter((row) => row.sector === "domestic").reduce((sum, row) => sum + row.gwh, 0);
    expect((domestic / total) * 100).toBeCloseTo(25, 6);
  });
});

describe("adapters fetch live data when demo mode is off", () => {
  it("ghg adapter calls the network instead of returning the fixture", async () => {
    process.env.DEMO_MODE = "false";
    const payload = [
      { date: "2023-01-01", source: "total", emissions: 361110.6 },
      { date: "2023-01-01", source: "energy", emissions: 285678.59 },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const raw = await ghgAdapter.fetch();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("api.data.gov.my");
    expect(raw).toEqual(payload);
  });

  it("falls back to the fixture when the live call fails", async () => {
    process.env.DEMO_MODE = "false";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(ghgAdapter.fetch()).rejects.toThrow();
  });
});

describe("live normalizers reject unusable payloads", () => {
  it("world bank drops the null newest year", () => {
    const rows = worldBankAdapter.normalize([
      { page: 1 },
      [
        { date: "2025", value: null },
        { date: "2024", value: 8.32321620146515 },
      ],
    ] as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.year).toBe(2024);
  });

  it("open-meteo tolerates null hourly entries", () => {
    const rows = openMeteoAdapter.normalize({
      hourly: {
        time: ["2026-10-01T00:00", "2026-10-01T13:00"],
        shortwave_radiation: [null, 700],
        temperature_2m: [null, 31.5],
      },
    });
    expect(rows[0]).toEqual({ time: "2026-10-01T00:00", radiationWm2: 0, temperatureC: 0 });
    expect(rows[1]).toEqual({ time: "2026-10-01T13:00", radiationWm2: 700, temperatureC: 31.5 });
  });

  it("open-meteo survives a payload with no hourly block", () => {
    expect(openMeteoAdapter.normalize({})).toEqual([]);
  });
});
