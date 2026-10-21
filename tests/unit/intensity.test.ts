import { describe, expect, it } from "vitest";
import {
  buildIntensityProfile,
  profileAnnualMean,
  intensityAt,
  I_MIN,
  I_MAX,
  malaysiaParts,
} from "@/domain/carbon/intensity";
import { getActiveFactor } from "@/domain/carbon/factors";

const profile = buildIntensityProfile();
const factor = getActiveFactor();

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

describe("intensity profile", () => {
  it("calibrates the annual mean to the published factor", () => {
    expect(Math.abs(profileAnnualMean(profile) - factor.kgPerKwh)).toBeLessThanOrEqual(0.0005);
  });

  it("respects the configured bounds", () => {
    for (const point of profile.points) {
      expect(point.kgPerKwh).toBeGreaterThanOrEqual(I_MIN);
      expect(point.kgPerKwh).toBeLessThanOrEqual(I_MAX);
    }
  });

  it("has an evening peak above the daily mean", () => {
    const evening = profile.points.filter((point) => point.hour >= 18 && point.hour <= 22);
    const all = profile.points;
    expect(average(evening.map((p) => p.kgPerKwh))).toBeGreaterThan(average(all.map((p) => p.kgPerKwh)));
  });

  it("shows solar suppression in the middle of the day", () => {
    const day = profile.points.filter((point) => point.hour >= 10 && point.hour <= 16);
    const night = profile.points.filter((point) => point.hour <= 5 || point.hour >= 22);
    expect(average(day.map((p) => p.kgPerKwh))).toBeLessThan(average(night.map((p) => p.kgPerKwh)));
  });

  it("keeps adjacent-hour changes smooth", () => {
    let maxJump = 0;
    for (let month = 1; month <= 12; month += 1) {
      for (const dayClass of ["weekday", "saturday", "sunday"] as const) {
        for (let hour = 1; hour < 24; hour += 1) {
          maxJump = Math.max(
            maxJump,
            Math.abs(intensityAt(profile, month, hour, dayClass) - intensityAt(profile, month, hour - 1, dayClass)),
          );
        }
      }
    }
    expect(maxJump).toBeLessThanOrEqual(0.08);
  });

  it("is memoized so repeated builds return the same profile", () => {
    expect(buildIntensityProfile()).toBe(profile);
  });
});

describe("Malaysian wall-clock conversion", () => {
  it("shifts UTC to UTC+8", () => {
    const parts = malaysiaParts(new Date("2026-09-01T00:00:00Z"));
    expect(parts.hour).toBe(8);
    expect(parts.month).toBe(9);
  });

  it("classifies Saturday and Sunday", () => {
    expect(malaysiaParts(new Date("2026-09-05T04:00:00Z")).dayClass).toBe("saturday");
    expect(malaysiaParts(new Date("2026-09-06T04:00:00Z")).dayClass).toBe("sunday");
    expect(malaysiaParts(new Date("2026-09-03T04:00:00Z")).dayClass).toBe("weekday");
  });
});
