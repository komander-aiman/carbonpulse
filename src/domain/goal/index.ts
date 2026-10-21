import { roundToFive } from "../carbon/rounding";

export type GoalRule = "provisional" | "confirmed";

export interface HouseholdGoal {
  readonly kwh: number;
  readonly rule: GoalRule;
  /** Number of confirmed periods the rule used. */
  readonly basisPeriods: number;
  readonly label: "Provisional" | "Confirmed";
}

export const GOAL_REDUCTION_FRACTION = 0.9;
export const CONFIRMED_RULE_PERIODS = 3;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

/**
 * D18: 1-2 confirmed periods -> provisional goal from the latest period alone;
 * 3+ -> confirmed goal from the trailing 3-period median. Both are 10% below the
 * basis usage, rounded to 5 kWh. An empty history has no goal.
 */
export function householdGoal(confirmedKwhOldestFirst: readonly number[]): HouseholdGoal | null {
  const usable = confirmedKwhOldestFirst.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length === 0) return null;

  if (usable.length < CONFIRMED_RULE_PERIODS) {
    const latest = usable[usable.length - 1]!;
    return {
      kwh: roundToFive(latest * GOAL_REDUCTION_FRACTION),
      rule: "provisional",
      basisPeriods: usable.length,
      label: "Provisional",
    };
  }

  const trailing = usable.slice(-CONFIRMED_RULE_PERIODS);
  return {
    kwh: roundToFive(median(trailing) * GOAL_REDUCTION_FRACTION),
    rule: "confirmed",
    basisPeriods: trailing.length,
    label: "Confirmed",
  };
}

export function goalCopy(goal: HouseholdGoal | null): string {
  if (!goal) return "Add a confirmed bill to set a goal.";
  if (goal.rule === "provisional") {
    return `Provisional goal · 10% below your latest confirmed bill. It becomes confirmed after three periods.`;
  }
  return `Confirmed goal · 10% below your trailing three-period median.`;
}
