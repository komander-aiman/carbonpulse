import type { HouseholdGoal } from "../goal";
import type { ZoneResult } from "../zone";

export interface SharedGoalInput {
  readonly zoneId: string;
  readonly goals: readonly HouseholdGoal[];
  readonly referenceKwh: readonly number[];
  readonly currentKwh: readonly number[];
  readonly zone: ZoneResult;
}

export interface SharedGoal {
  readonly suppressed: false;
  readonly zoneId: string;
  readonly householdCount: number;
  readonly referenceKwh: number;
  readonly currentKwh: number;
  readonly targetKwh: number;
  readonly progressPct: number;
  /** True when the current period is above the reference period. */
  readonly aboveGoal: boolean;
}

export interface SuppressedSharedGoal {
  readonly suppressed: true;
  readonly zoneId: string;
  readonly reason: string;
}

export type SharedGoalResult = SharedGoal | SuppressedSharedGoal;

function round5(value: number): number {
  return Math.round(value / 5) * 5;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * D17: the shared goal is the sum of each consenting household's own goal.
 * Progress compares the current period with a reference period and is clamped
 * to 0-100. The result is published only when the zone itself publishes at k.
 */
export function sharedGoal(input: SharedGoalInput): SharedGoalResult {
  if (input.zone.suppressed) {
    return { suppressed: true, zoneId: input.zoneId, reason: "zone_suppressed" };
  }
  if (input.goals.length === 0) {
    return { suppressed: true, zoneId: input.zoneId, reason: "no_household_goals" };
  }

  const reference = sum(input.referenceKwh);
  const current = sum(input.currentKwh);
  const target = sum(input.goals.map((goal) => goal.kwh));
  const required = reference - target;

  if (required <= 0) {
    return { suppressed: true, zoneId: input.zoneId, reason: "target_not_below_reference" };
  }

  const raw = ((reference - current) / required) * 100;
  const progressPct = Math.max(0, Math.min(100, raw));

  return {
    suppressed: false,
    zoneId: input.zoneId,
    householdCount: input.zone.householdCount,
    referenceKwh: round5(reference),
    currentKwh: round5(current),
    targetKwh: round5(target),
    progressPct: Math.round(progressPct),
    aboveGoal: current > reference,
  };
}

export function sharedGoalCopy(result: SharedGoalResult): string {
  if (result.suppressed) return "Not enough data yet";
  if (result.aboveGoal) {
    return `Above the shared goal · ${result.currentKwh} kWh this period against ${result.referenceKwh} kWh in the reference period`;
  }
  return `Shared goal · ${result.householdCount} households · ${result.progressPct}% of the way to ${result.targetKwh} kWh`;
}
