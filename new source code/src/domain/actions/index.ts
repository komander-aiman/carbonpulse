import { getActiveFactor } from "../carbon/factors";
import { roundKg } from "../carbon/rounding";
import type { FactorVersion } from "../carbon/types";

export type Effort = 1 | 2 | 3;

export type ActionCategory =
  | "cooling"
  | "standby"
  | "lighting"
  | "hot_water"
  | "appliance_scheduling";

export interface ActionEvidence {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly category: ActionCategory;
  readonly description: string;
  readonly tip: string;
  /** Monthly kWh saved, low and high estimates. */
  readonly kwhLow: number;
  readonly kwhHigh: number;
  readonly effort: Effort;
  readonly evidenceVersion: string;
  readonly source: string;
  readonly appliesTo: readonly ("ac_evening" | "ac_all_day" | "workday_absent" | "mixed")[];
  readonly confidence: "low" | "medium" | "high";
}

export const EVIDENCE_VERSION = "actions-1.0.0";

export const ACTIONS: readonly ActionEvidence[] = [
  {
    id: "temperature",
    title: "Keep cooling at 24–26°C",
    shortTitle: "Cool smarter",
    category: "cooling",
    description:
      "Pair the temperature setting with a fan and close doors to cool the occupied space first.",
    tip: "Small thermostat adjustments are repeatable and do not need new equipment.",
    kwhLow: 12,
    kwhHigh: 18,
    effort: 1,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Malaysian household cooling field studies, 2023 range",
    appliesTo: ["ac_evening", "ac_all_day", "mixed"],
    confidence: "high",
  },
  {
    id: "timer",
    title: "Use a 2-hour sleep timer",
    shortTitle: "Night timer",
    category: "cooling",
    description:
      "Pre-cool the room, then let the timer switch off the air conditioner after you fall asleep.",
    tip: "Set one reusable timer on the remote tonight and keep a fan on low afterwards.",
    kwhLow: 8,
    kwhHigh: 12,
    effort: 1,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Cooling duty-cycle assumption, 2024",
    appliesTo: ["ac_evening", "ac_all_day", "mixed"],
    confidence: "medium",
  },
  {
    id: "standby",
    title: "Switch off one entertainment zone",
    shortTitle: "Cut standby",
    category: "standby",
    description: "Use a switched power strip for the TV, console, speakers and chargers when idle.",
    tip: "Place the strip where the switch is visible and make it part of leaving the room.",
    kwhLow: 3,
    kwhHigh: 5,
    effort: 1,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Standby power measurements, 2022 range",
    appliesTo: ["ac_evening", "ac_all_day", "workday_absent", "mixed"],
    confidence: "medium",
  },
  {
    id: "led",
    title: "Replace the most-used bulbs with LEDs",
    shortTitle: "Switch to LED",
    category: "lighting",
    description: "Swap the bulbs used most in the evening first; the saving repeats every night.",
    tip: "Start with the living room and kitchen, which are usually lit longest.",
    kwhLow: 4,
    kwhHigh: 8,
    effort: 2,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Lighting wattage comparison, 2023",
    appliesTo: ["ac_evening", "ac_all_day", "workday_absent", "mixed"],
    confidence: "high",
  },
  {
    id: "water-heater",
    title: "Shorten water-heating time",
    shortTitle: "Trim hot water",
    category: "hot_water",
    description: "Run the heater only before the usual shower window rather than all evening.",
    tip: "A timer on the heater removes the hours nobody is using hot water.",
    kwhLow: 6,
    kwhHigh: 14,
    effort: 2,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Water heater duty-cycle estimate, 2023",
    appliesTo: ["ac_evening", "workday_absent", "mixed"],
    confidence: "medium",
  },
  {
    id: "appliance-schedule",
    title: "Shift laundry and dishwashing",
    shortTitle: "Shift heavy loads",
    category: "appliance_scheduling",
    description: "Run full loads only, and avoid starting them during the evening peak.",
    tip: "Two full loads beat four partial ones for the same clothes.",
    kwhLow: 3,
    kwhHigh: 7,
    effort: 1,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Appliance load scheduling, 2024",
    appliesTo: ["ac_evening", "ac_all_day", "workday_absent", "mixed"],
    confidence: "medium",
  },
  {
    id: "fridge-clearance",
    title: "Give the fridge room to breathe",
    shortTitle: "Clear the fridge",
    category: "appliance_scheduling",
    description: "Leave clearance at the back and sides so the compressor runs less.",
    tip: "Check the door seal at the same time.",
    kwhLow: 2,
    kwhHigh: 4,
    effort: 1,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Refrigeration clearance guidance, 2022",
    appliesTo: ["ac_evening", "ac_all_day", "workday_absent", "mixed"],
    confidence: "low",
  },
  {
    id: "ac-servicing",
    title: "Service the air conditioner filter",
    shortTitle: "Clean the filter",
    category: "cooling",
    description: "A blocked filter makes the unit work harder for the same comfort.",
    tip: "Clean monthly during the wet season.",
    kwhLow: 2,
    kwhHigh: 6,
    effort: 2,
    evidenceVersion: EVIDENCE_VERSION,
    source: "Air-conditioner maintenance guidance, 2023",
    appliesTo: ["ac_evening", "ac_all_day"],
    confidence: "medium",
  },
];

export const PLAN_CAP_FRACTION = 0.35;

export interface RankedAction extends ActionEvidence {
  readonly kgLow: number;
  readonly kgHigh: number;
  readonly midKg: number;
  readonly rank: number;
  readonly selected: boolean;
  readonly reason: string;
}

function mid(range: ActionEvidence): number {
  return (range.kwhLow + range.kwhHigh) / 2;
}

export function rankActions(
  archetype: string,
  factor: FactorVersion = getActiveFactor(),
): RankedAction[] {
  const eligible = ACTIONS.filter((action) =>
    (action.appliesTo as readonly string[]).includes(archetype),
  );
  const sorted = [...eligible].sort((a, b) => {
    const scoreA = mid(a) / a.effort;
    const scoreB = mid(b) / b.effort;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((action, index) => ({
    ...action,
    kgLow: roundKg(action.kwhLow * factor.kgPerKwh),
    kgHigh: roundKg(action.kwhHigh * factor.kgPerKwh),
    midKg: roundKg(mid(action) * factor.kgPerKwh),
    rank: index + 1,
    selected: index < 6,
    reason:
      action.appliesTo.length === 1
        ? `Matched your ${archetype.replaceAll("_", " ")} routine.`
        : `Fits most households, including ${archetype.replaceAll("_", " ")} routines.`,
  }));
}

export function suggestedActions(
  archetype: string,
  factor: FactorVersion = getActiveFactor(),
): RankedAction[] {
  return rankActions(archetype, factor).slice(0, 6);
}

/**
 * Aggregated plan potential is capped at a share of the baseline. The cap is
 * returned so the UI can disclose it rather than hiding the truncation.
 */
export function planPotential(
  actions: readonly { readonly kwhLow: number; readonly kwhHigh: number }[],
  baselineKwh: number,
): { low: number; high: number; cappedHigh: number; capped: boolean; capKwh: number } {
  const low = actions.reduce((sum, action) => sum + action.kwhLow, 0);
  const high = actions.reduce((sum, action) => sum + action.kwhHigh, 0);
  const capKwh = baselineKwh * PLAN_CAP_FRACTION;
  return {
    low,
    high,
    cappedHigh: Math.min(high, capKwh),
    capped: high > capKwh,
    capKwh,
  };
}

export type HouseholdActionState = "suggested" | "done" | "snoozed" | "dismissed";
