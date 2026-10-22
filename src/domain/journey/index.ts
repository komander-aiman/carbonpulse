import type { Effort, HouseholdActionState } from "../actions";
import { householdGoal, type HouseholdGoal } from "../goal";

/**
 * Framework-free journey rules. Nothing here reads a store, a cookie, or the
 * clock: every input is explicit so billing-day normalisation, comparison and
 * next-step selection stay deterministic and testable.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Parses a calendar day as UTC midnight, rejecting impossible dates. */
export function parseBillingDay(value: string): number | null {
  const match = ISO_DAY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const date = new Date(stamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return stamp;
}

/**
 * Billing days inside validated boundaries. The end date is exclusive, which
 * matches how a bill reads (1 April to 1 May is 30 billed days). Invalid or
 * inverted boundaries return null rather than a guessed denominator.
 */
export function billingDays(periodStart: string, periodEnd: string): number | null {
  const start = parseBillingDay(periodStart);
  const end = parseBillingDay(periodEnd);
  if (start === null || end === null || end <= start) return null;
  return Math.round((end - start) / DAY_MS);
}

export interface JourneyPeriodInput {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly kwh: number;
  readonly flatKg: number;
  readonly modelledKg: number;
  readonly source: string;
  readonly confirmedAt: string;
  readonly isDemo: boolean;
  readonly factorId: string | null;
  readonly factorKgPerKwh: number | null;
  readonly modelId: string | null;
  /** True when the stored estimate was kept; false when it was recomputed. */
  readonly estimateStored: boolean;
}

export interface NormalisedPeriod extends JourneyPeriodInput {
  readonly days: number | null;
  /** Recorded total divided by validated billing days. Null when it cannot. */
  readonly kwhPerDay: number | null;
  /** Human label derived from the period start, e.g. "April 2026". */
  readonly label: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** UTC month label, so the same record reads identically on every server. */
export function periodLabel(periodStart: string): string {
  const stamp = parseBillingDay(periodStart);
  if (stamp === null) return periodStart;
  const date = new Date(stamp);
  return `${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`.trim();
}

export function normalisePeriod(period: JourneyPeriodInput): NormalisedPeriod {
  const days = billingDays(period.periodStart, period.periodEnd);
  return {
    ...period,
    days,
    kwhPerDay: kwhPerDay(period.kwh, days),
    label: periodLabel(period.periodStart),
  };
}

/** Recorded kWh divided by billing days. Zero, missing and invalid inputs are null. */
export function kwhPerDay(kwh: number, days: number | null | undefined): number | null {
  if (!Number.isFinite(kwh) || kwh <= 0) return null;
  if (days === null || days === undefined || !Number.isFinite(days) || days <= 0) return null;
  return kwh / days;
}

export type ComparisonMetric = "kwh_per_day";

export interface UsageComparison {
  readonly metric: ComparisonMetric;
  readonly from: NormalisedPeriod;
  readonly to: NormalisedPeriod;
  readonly fromKwhPerDay: number | null;
  readonly toKwhPerDay: number | null;
  readonly deltaKwhPerDay: number | null;
  /** Percentage change of the daily metric; null when the baseline is missing or zero. */
  readonly deltaPct: number | null;
  readonly hasBaseline: boolean;
  readonly factorIds: readonly string[];
  readonly factorsDiffer: boolean;
  readonly emissionsComparable: boolean;
  /**
   * True when a stored estimate is being compared with a recomputed one, or
   * when either record predates stored factor versions.
   */
  readonly usesRecomputedEstimate: boolean;
}

/**
 * Compares two different-length periods on kWh per day, never on the raw
 * monthly total. Emissions are only compared when both records carry the same
 * stored factor version; otherwise the caller must explain why not.
 */
export function compareUsage(
  previous: NormalisedPeriod,
  current: NormalisedPeriod,
): UsageComparison {
  const from = previous.kwhPerDay;
  const to = current.kwhPerDay;
  const hasBaseline = from !== null && from > 0;
  const factorsDiffer = previous.factorId !== current.factorId;
  const bothStored = previous.estimateStored && current.estimateStored;
  return {
    metric: "kwh_per_day",
    from: previous,
    to: current,
    fromKwhPerDay: from,
    toKwhPerDay: to,
    deltaKwhPerDay: from !== null && to !== null ? to - from : null,
    deltaPct: hasBaseline && to !== null ? ((to - from) / from) * 100 : null,
    hasBaseline,
    factorIds: [previous.factorId, current.factorId].filter((id): id is string => Boolean(id)),
    factorsDiffer: factorsDiffer || !previous.factorId || !current.factorId,
    emissionsComparable: hasBaseline && bothStored && !factorsDiffer,
    usesRecomputedEstimate: !bothStored,
  };
}

export interface TrendSummary {
  readonly periods: readonly NormalisedPeriod[];
  readonly latest: NormalisedPeriod | null;
  readonly previous: NormalisedPeriod | null;
  readonly comparison: UsageComparison | null;
  readonly totalKwh: number;
  readonly totalDays: number;
  readonly meanKwhPerDay: number | null;
  readonly hasBills: boolean;
  readonly hasHistory: boolean;
  readonly state: "empty" | "single" | "insufficient" | "ready";
}

/**
 * Usage-trend summary. `single` is one recorded bill, `insufficient` is two
 * bills where at least one period cannot be normalised, and `ready` is at
 * least two comparable daily values.
 */
export function summariseTrend(input: readonly JourneyPeriodInput[]): TrendSummary {
  const periods = [...input]
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map(normalisePeriod);
  const latest = periods.at(-1) ?? null;
  const previous = periods.length >= 2 ? (periods.at(-2) ?? null) : null;
  const comparison = previous && latest ? compareUsage(previous, latest) : null;
  const totalKwh = periods.reduce((sum, period) => sum + (Number.isFinite(period.kwh) ? period.kwh : 0), 0);
  const totalDays = periods.reduce((sum, period) => sum + (period.days ?? 0), 0);

  let state: TrendSummary["state"] = "empty";
  if (periods.length === 1) state = "single";
  else if (periods.length >= 2) {
    state =
      comparison && comparison.hasBaseline && comparison.toKwhPerDay !== null
        ? "ready"
        : "insufficient";
  }

  return {
    periods,
    latest,
    previous,
    comparison,
    totalKwh,
    totalDays,
    meanKwhPerDay: totalDays > 0 ? totalKwh / totalDays : null,
    hasBills: periods.length > 0,
    hasHistory: periods.length >= 2,
    state,
  };
}

/**
 * Observed-change wording. It describes the two recorded periods and never
 * attributes the difference to an action, a plan, or a projected saving.
 */
export function observedChangeCopy(comparison: UsageComparison): string {
  if (comparison.fromKwhPerDay === null || comparison.toKwhPerDay === null) {
    return "This pair of periods cannot be compared because one period has no usable daily baseline.";
  }
  if (!comparison.hasBaseline || comparison.deltaPct === null) {
    return "The earlier period has a zero daily baseline, so a percentage change is not meaningful. Compare the two daily values instead.";
  }
  if (comparison.deltaPct === 0) {
    return "Observed daily use is unchanged between these two billing periods.";
  }
  const direction = comparison.deltaPct < 0 ? "lower" : "higher";
  return `Observed daily use is ${Math.abs(comparison.deltaPct).toFixed(1)}% ${direction} than the previous billing period. This is an observed usage change, not a measured saving from any action.`;
}

export function emissionsComparisonCopy(comparison: UsageComparison): string {
  if (!comparison.emissionsComparable) {
    if (comparison.factorsDiffer) {
      return "Emission estimates use different factor versions, so they are shown per period but not compared. Stored estimates are never recalculated to force a comparison.";
    }
    return "A stored factor version is missing for at least one period, so emissions are shown per period but not compared.";
  }
  return "Both periods use the same stored factor version, so their estimated emissions can be compared alongside daily usage.";
}

export function goalProgress(goalKwh: number | null, currentKwh: number | null): number | null {
  if (goalKwh === null || currentKwh === null || goalKwh <= 0 || currentKwh <= 0) return null;
  return Math.max(0, Math.min(100, (goalKwh / currentKwh) * 100));
}

/**
 * A goal milestone is only recorded for a newly confirmed bill that meets the
 * goal computed from the periods before it. No historical goal is invented.
 */
export function goalReachedByNewPeriod(
  previousKwhOldestFirst: readonly number[],
  newKwh: number,
): HouseholdGoal | null {
  const goal = householdGoal(previousKwhOldestFirst);
  if (!goal || !Number.isFinite(newKwh) || newKwh <= 0) return null;
  return newKwh <= goal.kwh ? goal : null;
}

export interface NextStepAction {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly state: HouseholdActionState;
  readonly effort: Effort;
}

export type JourneyNextStep =
  | {
      readonly kind: "enter_first_bill";
      readonly title: string;
      readonly body: string;
      readonly href: "/energy/upload";
      readonly actionId: null;
    }
  | {
      readonly kind: "action";
      readonly title: string;
      readonly body: string;
      readonly href: "/actions";
      readonly actionId: string;
    }
  | {
      readonly kind: "review_plan";
      readonly title: string;
      readonly body: string;
      readonly href: "/actions";
      readonly actionId: null;
    };

/**
 * Deterministic next step:
 *   1. no bill -> enter the first bill;
 *   2. otherwise the first recommended action that is not complete
 *      (suggested first, then snoozed, in the caller's stable ranking order);
 *   3. when none remains -> review the plan (the card also links to the next bill).
 * Dismissed actions are intentionally not recommended again.
 */
export function selectNextStep(input: {
  readonly billCount: number;
  readonly hasGoal: boolean;
  readonly actions: readonly NextStepAction[];
}): JourneyNextStep {
  if (input.billCount === 0) {
    return {
      kind: "enter_first_bill",
      title: "Add your first bill",
      body: "One confirmed kWh total is enough to start your history, set a provisional goal, and see your first evidence-labelled estimate.",
      href: "/energy/upload",
      actionId: null,
    };
  }

  const open = input.actions.filter((action) => action.state !== "dismissed" && action.state !== "done");
  const next = open.find((action) => action.state === "suggested") ?? open[0];
  if (next) {
    return {
      kind: "action",
      title: next.shortTitle,
      body: next.description,
      href: "/actions",
      actionId: next.id,
    };
  }

  return {
    kind: "review_plan",
    title: "Review your plan",
    body: input.hasGoal
      ? "Every recommended action is marked complete. Review the plan, or add your next bill to see how the newly recorded period compares on kWh per day."
      : "Every recommended action is marked complete. Review the plan, or add a bill to set your goal.",
    href: "/actions",
    actionId: null,
  };
}

export interface JourneyMilestoneInput {
  readonly id: string;
  readonly kind: "goal_reached" | "action_completed";
  readonly label: string;
  readonly detail: string;
  readonly occurredAt: string;
  readonly isDemo: boolean;
}

export interface JourneyActionInput {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly state: HouseholdActionState;
  readonly updatedAt: string | null;
}

export type JourneyEvent =
  | {
      readonly kind: "bill";
      readonly id: string;
      readonly date: string;
      readonly period: NormalisedPeriod;
    }
  | {
      readonly kind: "milestone";
      readonly id: string;
      readonly date: string;
      readonly milestone: JourneyMilestoneInput;
    }
  | {
      readonly kind: "action";
      readonly id: string;
      readonly date: string;
      readonly action: JourneyActionInput;
    };

/**
 * Chronological events. Bills use their billing-period start; completed actions
 * use the stored state timestamp; goal milestones use the recorded time. Nothing
 * is synthesised when a supporting record is absent.
 */
export function buildJourneyEvents(input: {
  readonly periods: readonly NormalisedPeriod[];
  readonly milestones: readonly JourneyMilestoneInput[];
  readonly actions: readonly JourneyActionInput[];
}): JourneyEvent[] {
  const events: JourneyEvent[] = [];
  for (const period of input.periods) {
    events.push({ kind: "bill", id: `bill:${period.id}`, date: period.periodStart, period });
  }
  for (const milestone of input.milestones) {
    events.push({
      kind: "milestone",
      id: `milestone:${milestone.id}`,
      date: milestone.occurredAt,
      milestone,
    });
  }
  for (const action of input.actions) {
    if (action.state !== "done" || !action.updatedAt) continue;
    events.push({
      kind: "action",
      id: `action:${action.id}`,
      date: action.updatedAt,
      action,
    });
  }
  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const order = { bill: 0, milestone: 1, action: 2 } as const;
    return order[a.kind] - order[b.kind] || a.id.localeCompare(b.id);
  });
}
