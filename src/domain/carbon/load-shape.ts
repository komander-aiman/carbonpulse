import type { ArchetypeId, DayClass, LoadProfile } from "./types";

type HourWeights = readonly number[];

interface ArchetypeDefinition {
  readonly label: string;
  readonly description: string;
  readonly weights: Readonly<Record<DayClass, HourWeights>>;
}

/**
 * Raw hour weights, normalized at construction. These encode routine
 * assumptions only; they never change the monthly total.
 */
const DEFINITIONS: Readonly<Record<ArchetypeId, ArchetypeDefinition>> = {
  ac_evening: {
    label: "Evening cooling",
    description: "Air conditioning concentrated in the evening and overnight.",
    weights: {
      weekday: [
        0.7, 0.65, 0.6, 0.55, 0.5, 0.5, 0.6, 0.8, 0.9, 0.8, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.95,
        1.1, 1.3, 1.5, 1.6, 1.5, 1.2, 0.95,
      ],
      saturday: [
        0.8, 0.75, 0.7, 0.65, 0.6, 0.6, 0.7, 0.85, 0.95, 0.9, 0.85, 0.85, 0.9, 0.9, 0.9, 0.95,
        1.05, 1.2, 1.4, 1.55, 1.6, 1.5, 1.25, 1.0,
      ],
      sunday: [
        0.8, 0.75, 0.7, 0.65, 0.6, 0.6, 0.7, 0.85, 0.9, 0.85, 0.8, 0.8, 0.85, 0.85, 0.85, 0.9,
        1.0, 1.2, 1.45, 1.6, 1.65, 1.55, 1.3, 1.05,
      ],
    },
  },
  ac_all_day: {
    label: "All-day cooling",
    description: "Cooling runs through the afternoon as well as at night.",
    weights: {
      weekday: [
        1.1, 1.0, 0.95, 0.9, 0.85, 0.85, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.45, 1.45, 1.4, 1.35,
        1.3, 1.3, 1.35, 1.4, 1.45, 1.4, 1.3, 1.2,
      ],
      saturday: [
        1.15, 1.05, 1.0, 0.95, 0.9, 0.9, 0.95, 1.05, 1.15, 1.25, 1.35, 1.45, 1.5, 1.5, 1.45,
        1.4, 1.35, 1.35, 1.4, 1.45, 1.5, 1.45, 1.35, 1.25,
      ],
      sunday: [
        1.15, 1.05, 1.0, 0.95, 0.9, 0.9, 0.95, 1.05, 1.15, 1.25, 1.35, 1.45, 1.5, 1.5, 1.45,
        1.4, 1.35, 1.35, 1.4, 1.45, 1.5, 1.45, 1.35, 1.25,
      ],
    },
  },
  workday_absent: {
    label: "Out during the day",
    description: "The home is empty on weekdays, with morning and evening peaks.",
    weights: {
      weekday: [
        0.6, 0.55, 0.5, 0.45, 0.45, 0.5, 0.8, 1.3, 1.4, 0.7, 0.4, 0.35, 0.35, 0.35, 0.4, 0.5,
        0.7, 1.0, 1.3, 1.5, 1.6, 1.5, 1.1, 0.8,
      ],
      saturday: [
        0.8, 0.75, 0.7, 0.65, 0.6, 0.6, 0.7, 0.9, 1.0, 1.05, 1.1, 1.1, 1.1, 1.05, 1.05, 1.05,
        1.1, 1.2, 1.35, 1.45, 1.5, 1.4, 1.2, 1.0,
      ],
      sunday: [
        0.85, 0.8, 0.75, 0.7, 0.65, 0.65, 0.75, 0.9, 1.0, 1.05, 1.05, 1.05, 1.05, 1.0, 1.0,
        1.0, 1.05, 1.2, 1.4, 1.5, 1.55, 1.45, 1.25, 1.0,
      ],
    },
  },
  mixed: {
    label: "Mixed routine",
    description: "A blend of daytime occupancy and evening cooling.",
    weights: {
      weekday: [
        0.85, 0.8, 0.75, 0.7, 0.65, 0.65, 0.75, 1.0, 1.1, 1.0, 0.95, 1.0, 1.05, 1.0, 1.0, 1.05,
        1.15, 1.25, 1.4, 1.5, 1.55, 1.45, 1.2, 1.0,
      ],
      saturday: [
        0.9, 0.85, 0.8, 0.75, 0.7, 0.7, 0.8, 0.95, 1.05, 1.05, 1.05, 1.1, 1.15, 1.1, 1.1, 1.1,
        1.15, 1.25, 1.4, 1.5, 1.55, 1.45, 1.25, 1.05,
      ],
      sunday: [
        0.9, 0.85, 0.8, 0.75, 0.7, 0.7, 0.8, 0.95, 1.05, 1.05, 1.05, 1.1, 1.15, 1.1, 1.1, 1.1,
        1.15, 1.25, 1.4, 1.5, 1.55, 1.45, 1.25, 1.05,
      ],
    },
  },
};

export const ARCHETYPES: Readonly<Record<ArchetypeId, { label: string; description: string }>> =
  Object.fromEntries(
    (Object.keys(DEFINITIONS) as ArchetypeId[]).map((id) => [
      id,
      { label: DEFINITIONS[id].label, description: DEFINITIONS[id].description },
    ]),
  ) as Record<ArchetypeId, { label: string; description: string }>;

function normalize(hours: HourWeights): readonly number[] {
  if (hours.length !== 24) throw new Error("Load shape must have 24 hourly weights");
  const total = hours.reduce((sum, value) => sum + value, 0);
  const normalized = hours.map((value) => value / total);
  const drift = 1 - normalized.reduce((sum, value) => sum + value, 0);
  normalized[0] = (normalized[0] ?? 0) + drift;
  return normalized;
}

const cache = new Map<ArchetypeId, LoadProfile>();

export function getLoadProfile(archetype: ArchetypeId): LoadProfile {
  const existing = cache.get(archetype);
  if (existing) return existing;
  const definition = DEFINITIONS[archetype];
  const profile: LoadProfile = {
    archetype,
    weights: {
      weekday: normalize(definition.weights.weekday),
      saturday: normalize(definition.weights.saturday),
      sunday: normalize(definition.weights.sunday),
    },
  };
  cache.set(archetype, profile);
  return profile;
}

export const DEFAULT_ARCHETYPE: ArchetypeId = "mixed";
