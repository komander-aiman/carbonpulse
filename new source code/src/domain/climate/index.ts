import type { Precinct } from "@/domain/climate/types";
import { flatEstimate } from "@/domain/carbon/estimates";
import type { FactorVersion } from "@/domain/carbon/types";

export type MapLayer = "scope" | "co2" | "air";

export type MarkerTone = "emerald" | "amber" | "orange";

export interface MarkerMetric {
  readonly value: number;
  readonly display: string;
  readonly unit: string;
  readonly label: string;
  readonly tone: MarkerTone;
}

/**
 * Which precincts respond to the community saving slider. Only the two Elmina
 * residential precincts are in the pilot, so the others stay at their baseline
 * rather than pretending the whole map moves.
 */
export const PILOT_PRECINCT_IDS: readonly string[] = ["elmina-west", "elmina-east"];

export function scenarioFraction(precinctId: string, reductionPct: number): number {
  return PILOT_PRECINCT_IDS.includes(precinctId) ? Math.max(0, Math.min(100, reductionPct)) / 100 : 0;
}

/** Monthly kg CO₂e for one home in a precinct, under the current scenario. */
export function precinctKg(
  precinct: Precinct,
  reductionPct: number,
  factor: FactorVersion,
): number {
  const fraction = scenarioFraction(precinct.id, reductionPct);
  const kwh = precinct.baselineKwh * (1 - fraction);
  return flatEstimate(kwh, factor).kgCo2e;
}

function toneFor(value: number, low: number, high: number): MarkerTone {
  if (value < low) return "emerald";
  if (value <= high) return "amber";
  return "orange";
}

export function markerMetric(
  precinct: Precinct,
  layer: MapLayer,
  reductionPct: number,
  factor: FactorVersion,
): MarkerMetric {
  if (layer === "co2") {
    const value = precinct.atmosphere.co2Ppm;
    return {
      value,
      display: value.toFixed(1),
      unit: "ppm CO₂",
      label: "Atmospheric CO₂",
      tone: toneFor(value, 427, 430),
    };
  }
  if (layer === "air") {
    const value = precinct.atmosphere.aqi;
    return {
      value,
      display: String(Math.round(value)),
      unit: "US AQI",
      label: "Air quality",
      tone: value <= 50 ? "emerald" : value <= 100 ? "amber" : "orange",
    };
  }
  const kg = precinctKg(precinct, reductionPct, factor);
  return {
    value: kg,
    display: String(Math.round(kg)),
    unit: "kg CO₂e/home",
    label: "Household scenario",
    tone: toneFor(kg, 225, 255),
  };
}

export interface LayerCopy {
  readonly description: string;
  readonly legend: readonly { readonly label: string; readonly tone: MarkerTone }[];
}

export function layerCopy(layer: MapLayer, factor: FactorVersion): LayerCopy {
  switch (layer) {
    case "co2":
      return {
        description:
          "Regional atmospheric CO₂ model estimates at roughly 11 km resolution. This is background concentration, not a township reading and not attributable to these households.",
        legend: [
          { label: "<427 ppm", tone: "emerald" },
          { label: "427–430 ppm", tone: "amber" },
          { label: ">430 ppm", tone: "orange" },
        ],
      };
    case "air":
      return {
        description:
          "Live US AQI with carbon monoxide and PM2.5 from the CAMS ENSEMBLE model. A regional estimate, not a sensor in the township.",
        legend: [
          { label: "Good / ≤50", tone: "emerald" },
          { label: "Moderate", tone: "amber" },
          { label: "Unhealthy", tone: "orange" },
        ],
      };
    default:
      return {
        description: `Illustrative monthly electricity-use scenario using the ${factor.year} ${factor.status} Peninsular Malaysia grid factor (${factor.kgPerKwh.toFixed(3)} kg CO₂e/kWh). A what-if computation, not a corporate emissions inventory.`,
        legend: [
          { label: "Low / <225", tone: "emerald" },
          { label: "225–255", tone: "amber" },
          { label: "High / >255", tone: "orange" },
        ],
      };
  }
}

/** Average scope-3 scenario value across every precinct, for the summary card. */
export function averageScopeKg(
  precincts: readonly Precinct[],
  reductionPct: number,
  factor: FactorVersion,
): number {
  if (precincts.length === 0) return 0;
  const total = precincts.reduce((sum, precinct) => sum + precinctKg(precinct, reductionPct, factor), 0);
  return total / precincts.length;
}

export function globalCo2DeltaPct(ppm: number, preindustrial = 278): number {
  return (ppm / preindustrial - 1) * 100;
}

export interface TimelineEntry {
  readonly year: string;
  readonly badge: string;
  readonly ppm: number;
  readonly title: string;
  readonly description: string;
  readonly comparison: string;
}

export const TIMELINE_BASE: readonly TimelineEntry[] = [
  {
    year: "1850",
    badge: "Pre-industrial",
    ppm: 278,
    title: "The atmospheric reference point",
    description:
      "A 278 ppm pre-industrial reference anchors the long-term global story. It is context, not a local township reading.",
    comparison: "Pre-industrial reference",
  },
  {
    year: "2021",
    badge: "SDP baseline",
    ppm: 416.4,
    title: "A baseline for corporate action",
    description:
      "SDP reports a 40% Scope 1 and 2 reduction target by 2030 measured from an FY2021 baseline. Scope 3 is baselined more broadly.",
    comparison: "+138.4 ppm from 1850",
  },
  {
    year: "2026",
    badge: "Live context",
    ppm: 427.4,
    title: "Global concentration, local choices",
    description:
      "Live global CO₂ is paired with Elmina microclimate context. It is neither a local air-quality reading nor a household impact metric.",
    comparison: "+149.4 ppm from 1850",
  },
  {
    year: "2030",
    badge: "SDP target",
    ppm: 427.4,
    title: "A portfolio target, not a ppm forecast",
    description:
      "SDP's 40% Scope 1 and 2 target is shown beside a separate household use-phase scenario. The resident estimate is not credited to that target.",
    comparison: "Live ppm held as context · no global forecast",
  },
];

/** Builds the timeline, substituting the live global value where relevant. */
export function timeline(livePpm: number): TimelineEntry[] {
  return TIMELINE_BASE.map((entry, index) => {
    if (index < 2) return entry;
    const ppm = livePpm;
    return {
      ...entry,
      ppm,
      comparison:
        index === 2
          ? `+${(ppm - 278).toFixed(1)} ppm from 1850`
          : entry.comparison,
    };
  });
}
