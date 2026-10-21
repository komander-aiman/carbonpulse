import { describe, expect, it } from "vitest";
import {
  averageScopeKg,
  globalCo2DeltaPct,
  layerCopy,
  markerMetric,
  precinctKg,
  scenarioFraction,
  timeline,
  PILOT_PRECINCT_IDS,
} from "@/domain/climate";
import type { Precinct } from "@/domain/climate/types";
import { getActiveFactor } from "@/domain/carbon/factors";

const factor = getActiveFactor();

function precinct(overrides: Partial<Precinct> = {}): Precinct {
  return {
    id: "elmina-west",
    name: "Elmina West",
    subtitle: "Pilot precinct",
    lat: 3.189,
    lon: 101.509,
    baselineKwh: 300,
    atmosphere: { co2Ppm: 428.2, aqi: 42, coMg: 186, pm25Ugm3: 11.8 },
    live: true,
    ...overrides,
  };
}

describe("scenario fraction", () => {
  it("applies the reduction only to pilot precincts", () => {
    for (const id of PILOT_PRECINCT_IDS) {
      expect(scenarioFraction(id, 10)).toBeCloseTo(0.1, 10);
    }
    expect(scenarioFraction("bukit-raja", 10)).toBe(0);
    expect(scenarioFraction("serenia-city", 25)).toBe(0);
  });

  it("clamps out-of-range reductions", () => {
    expect(scenarioFraction("elmina-west", -20)).toBe(0);
    expect(scenarioFraction("elmina-west", 150)).toBe(1);
  });
});

describe("precinct kg", () => {
  it("matches the flat factor for a 300 kWh baseline at 0%", () => {
    expect(precinctKg(precinct(), 0, factor)).toBeCloseTo(222, 6);
  });

  it("drops by 10% when the scenario is 10%", () => {
    expect(precinctKg(precinct(), 10, factor)).toBeCloseTo(222 * 0.9, 6);
  });

  it("leaves non-pilot precincts unchanged", () => {
    const other = precinct({ id: "bukit-raja", baselineKwh: 315 });
    expect(precinctKg(other, 20, factor)).toBeCloseTo(315 * factor.kgPerKwh, 6);
  });
});

describe("marker metrics", () => {
  it("returns kg CO₂e for the scope layer", () => {
    const metric = markerMetric(precinct(), "scope", 0, factor);
    expect(metric.unit).toBe("kg CO₂e/home");
    expect(metric.display).toBe("222");
    expect(metric.tone).toBe("emerald");
  });

  it("returns ppm for the CO₂ layer with threshold tones", () => {
    expect(markerMetric(precinct(), "co2", 0, factor).tone).toBe("amber");
    expect(markerMetric(precinct({ atmosphere: { ...precinct().atmosphere, co2Ppm: 425 } }), "co2", 0, factor).tone).toBe(
      "emerald",
    );
    expect(markerMetric(precinct({ atmosphere: { ...precinct().atmosphere, co2Ppm: 435 } }), "co2", 0, factor).tone).toBe(
      "orange",
    );
  });

  it("returns AQI for the air layer with AQI bands", () => {
    expect(markerMetric(precinct(), "air", 0, factor).unit).toBe("US AQI");
    expect(markerMetric(precinct(), "air", 0, factor).tone).toBe("emerald");
    expect(
      markerMetric(precinct({ atmosphere: { ...precinct().atmosphere, aqi: 75 } }), "air", 0, factor).tone,
    ).toBe("amber");
    expect(
      markerMetric(precinct({ atmosphere: { ...precinct().atmosphere, aqi: 155 } }), "air", 0, factor).tone,
    ).toBe("orange");
  });

  it("uses the higher threshold for the scope layer", () => {
    const high = precinct({ baselineKwh: 365 });
    expect(markerMetric(high, "scope", 0, factor).tone).toBe("orange");
  });
});

describe("layer copy", () => {
  it("names the active factor version on the scope layer", () => {
    expect(layerCopy("scope", factor).description).toContain(factor.kgPerKwh.toFixed(3));
  });

  it("always warns that CO₂ is a regional estimate", () => {
    expect(layerCopy("co2", factor).description).toMatch(/regional/i);
    expect(layerCopy("air", factor).description).toMatch(/not a sensor/i);
  });
});

describe("average scope kg", () => {
  it("averages across all precincts", () => {
    const list = [precinct(), precinct({ id: "bukit-raja", baselineKwh: 300 })];
    expect(averageScopeKg(list, 0, factor)).toBeCloseTo(222, 6);
  });

  it("returns zero for an empty list rather than NaN", () => {
    expect(averageScopeKg([], 0, factor)).toBe(0);
  });
});

describe("global CO₂ delta", () => {
  it("computes the percentage above pre-industrial", () => {
    expect(globalCo2DeltaPct(427.4)).toBeCloseTo(53.74, 2);
  });

  it("is zero at the pre-industrial reference", () => {
    expect(globalCo2DeltaPct(278)).toBe(0);
  });
});

describe("timeline", () => {
  it("pins the historical years and uses live ppm from 2026", () => {
    const entries = timeline(430);
    expect(entries[0]?.ppm).toBe(278);
    expect(entries[1]?.ppm).toBe(416.4);
    expect(entries[2]?.ppm).toBe(430);
    expect(entries[3]?.ppm).toBe(430);
  });

  it("never draws a 2030 forecast", () => {
    const entries = timeline(430);
    expect(entries[3]?.comparison).toMatch(/no global forecast/i);
    expect(entries[3]?.ppm).toBe(entries[2]?.ppm);
  });

  it("recomputes the 2026 comparison from the live value", () => {
    expect(timeline(428).at(2)?.comparison).toBe("+150.0 ppm from 1850");
  });
});
