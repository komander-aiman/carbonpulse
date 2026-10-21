/**
 * Prints the calibrated intensity profile summary and validation gates.
 * Run with `npm run calibrate`. This is a build/seed-time step, never a
 * request-time calculation.
 */
import { buildIntensityProfile, profileAnnualMean, intensityAt, I_MIN, I_MAX } from "../src/domain/carbon/intensity";
import { getActiveFactor } from "../src/domain/carbon/factors";

const profile = buildIntensityProfile();
const factor = getActiveFactor();
const mean = profileAnnualMean(profile);

const byMonth = new Map<number, number[]>();
for (const point of profile.points) {
  if (point.dayClass !== "weekday") continue;
  const list = byMonth.get(point.month) ?? [];
  list.push(point.kgPerKwh);
  byMonth.set(point.month, list);
}

const flatValues = profile.points.map((point) => point.kgPerKwh);
const evening = profile.points.filter((p) => p.hour >= 18 && p.hour <= 22).map((p) => p.kgPerKwh);
const daytime = profile.points.filter((p) => p.hour >= 10 && p.hour <= 16).map((p) => p.kgPerKwh);
const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

let maxJump = 0;
for (let month = 1; month <= 12; month += 1) {
  for (const dayClass of ["weekday", "saturday", "sunday"] as const) {
    for (let hour = 1; hour < 24; hour += 1) {
      const jump = Math.abs(
        intensityAt(profile, month, hour, dayClass) - intensityAt(profile, month, hour - 1, dayClass),
      );
      maxJump = Math.max(maxJump, jump);
    }
  }
}

const checks = [
  { name: "annual mean within 0.0005 of factor", ok: Math.abs(mean - factor.kgPerKwh) <= 0.0005, detail: `${mean.toFixed(6)} vs ${factor.kgPerKwh}` },
  { name: "no value below minimum", ok: Math.min(...flatValues) >= I_MIN - 1e-9, detail: Math.min(...flatValues).toFixed(4) },
  { name: "no value above maximum", ok: Math.max(...flatValues) <= I_MAX + 1e-9, detail: Math.max(...flatValues).toFixed(4) },
  { name: "daytime mean below evening peak", ok: avg(daytime) < avg(evening), detail: `${avg(daytime).toFixed(4)} < ${avg(evening).toFixed(4)}` },
  { name: "adjacent-hour jump below 0.08", ok: maxJump <= 0.08, detail: maxJump.toFixed(4) },
];

console.log(`Model ${profile.modelVersion.id}`);
console.log(`Calibrated ${profile.modelVersion.calibrationDate}`);
console.log(`Points ${profile.points.length}`);
console.log(`Annual demand-weighted mean ${mean.toFixed(6)} (target ${factor.kgPerKwh})\n`);

for (const [month, values] of byMonth) {
  console.log(`Month ${String(month).padStart(2, "0")} weekday mean ${avg(values).toFixed(4)}`);
}

console.log("");
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name} (${check.detail})`);
}

if (checks.some((check) => !check.ok)) process.exitCode = 1;
