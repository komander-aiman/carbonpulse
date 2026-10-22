import "server-only";

import { getActiveFactor } from "@/domain/carbon/factors";
import { buildIntensityProfile } from "@/domain/carbon/intensity";
import { flatEstimate, modelledEstimate } from "@/domain/carbon/estimates";
import { roundKg } from "@/domain/carbon/rounding";
import {
  suggestedActions,
  planPotential,
  type RankedAction,
  type HouseholdActionState,
  type PlanPotential,
} from "@/domain/actions";
import { householdGoal, type HouseholdGoal } from "@/domain/goal";
import {
  billingDays,
  buildJourneyEvents,
  goalProgress,
  kwhPerDay,
  selectNextStep,
  summariseTrend,
  type JourneyEvent,
  type JourneyNextStep,
  type JourneyPeriodInput,
  type TrendSummary,
} from "@/domain/journey";
import { summarise, type ProfileSummary } from "@/domain/profile";
import { buildExploreModel, type ExploreModel } from "@/domain/explore";
import {
  latestUsage,
  previousUsage,
  type HouseholdData,
  type UsageRecord,
} from "@/lib/household-store";
import { formatMonthLabel } from "@/lib/format";

export interface PeriodView {
  readonly id: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly label: string;
  readonly kwh: number;
  /** Billing days from validated boundaries, null when the period is unusable. */
  readonly days: number | null;
  readonly kwhPerDay: number | null;
  readonly flatKg: number;
  readonly modelledKg: number;
  readonly deltaKg: number;
  readonly deltaPct: number;
  readonly source: UsageRecord["source"];
  readonly confirmedAt: string;
  readonly isDemo: boolean;
  /** Stored factor version, or null for a legacy row without a stored estimate. */
  readonly factorId: string | null;
  readonly factorKgPerKwh: number | null;
  readonly modelId: string | null;
  /** False when the displayed figures were recomputed because none were stored. */
  readonly estimateStored: boolean;
}

export interface ActionView extends RankedAction {
  readonly state: HouseholdActionState;
}

export interface EnergyViewModel {
  readonly household: HouseholdData["household"];
  readonly periods: readonly PeriodView[];
  readonly current: PeriodView | null;
  readonly previous: PeriodView | null;
  readonly goal: HouseholdGoal | null;
  readonly targetKwh: number;
  readonly targetGapKwh: number;
  readonly flatKg: number;
  readonly modelledKg: number;
  readonly deltaKg: number;
  readonly deltaPct: number;
  readonly factor: ReturnType<typeof getActiveFactor>;
  readonly modelId: string;
  readonly calibrationDate: string;
  readonly isDemo: boolean;
  readonly hasRealRecords: boolean;
  readonly profile: ProfileSummary;
  readonly milestones: HouseholdData["milestones"];
}

function toPeriodView(record: UsageRecord, archetype: string, factor: ReturnType<typeof getActiveFactor>): PeriodView {
  const stored = record.estimate;
  const days = billingDays(record.periodStart, record.periodEnd);
  const perDay = kwhPerDay(record.kwh, days);
  // A stored estimate is immutable: we display it exactly as captured. Only a
  // legacy row with no stored estimate is recomputed, and the view marks that
  // so the journey can explain the difference.
  const base = {
    id: record.id,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    label: formatMonthLabel(record.periodStart),
    kwh: record.kwh,
    days,
    kwhPerDay: perDay,
    source: record.source,
    confirmedAt: record.confirmedAt,
    isDemo: record.isDemo,
  };

  if (stored) {
    const flat = stored.flatKg;
    const modelled = stored.modelledKg;
    return {
      ...base,
      flatKg: roundKg(flat),
      modelledKg: roundKg(modelled),
      deltaKg: roundKg(modelled - flat),
      deltaPct: flat === 0 ? 0 : ((modelled - flat) / flat) * 100,
      factorId: stored.factorId,
      factorKgPerKwh: stored.factorKgPerKwh,
      modelId: stored.modelId,
      estimateStored: true,
    };
  }

  const modelled = modelledEstimate({
    kwh: record.kwh,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    archetype: archetype as never,
    factor,
    intensity: buildIntensityProfile(),
  });
  const flat = flatEstimate(record.kwh, factor).kgCo2e;
  return {
    ...base,
    flatKg: roundKg(flat),
    modelledKg: roundKg(modelled.kgCo2e),
    deltaKg: roundKg(modelled.deltaKg),
    deltaPct: modelled.deltaPct,
    factorId: null,
    factorKgPerKwh: factor.kgPerKwh,
    modelId: modelled.model.id,
    estimateStored: false,
  };
}

export function buildEnergyViewModel(data: HouseholdData): EnergyViewModel {
  const factor = getActiveFactor("peninsular");
  const profile = buildIntensityProfile();
  const householdProfile = summarise(data.profile);

  const periods: PeriodView[] = data.usage.map((record) =>
    toPeriodView(record, householdProfile.archetype, factor),
  );

  const currentRecord = latestUsage(data);
  const previousRecord = previousUsage(data);
  const current = periods.find((period) => period.id === currentRecord?.id) ?? null;
  const previous = periods.find((period) => period.id === previousRecord?.id) ?? null;

  const goal = householdGoal(data.usage.map((record) => record.kwh));
  const flat = current?.flatKg ?? 0;
  const modelled = current?.modelledKg ?? 0;

  const targetKwh = goal?.kwh ?? 0;
  return {
    household: data.household,
    periods,
    current,
    previous,
    goal,
    targetKwh,
    targetGapKwh: current && targetKwh > 0 ? Math.max(0, current.kwh - targetKwh) : 0,
    flatKg: flat,
    modelledKg: modelled,
    deltaKg: current?.deltaKg ?? 0,
    deltaPct: current?.deltaPct ?? 0,
    factor,
    modelId: profile.modelVersion.id,
    calibrationDate: profile.modelVersion.calibrationDate,
    isDemo: data.household.isDemo || data.usage.every((record) => record.isDemo),
    hasRealRecords: data.usage.some((record) => !record.isDemo),
    profile: householdProfile,
    milestones: data.milestones,
  };
}

export interface ActionsViewModel {
  readonly actions: readonly ActionView[];
  readonly doneCount: number;
  readonly remainingCount: number;
  readonly suggestedCount: number;
  readonly completedPercent: number;
  readonly potential: PlanPotential;
  readonly goal: HouseholdGoal | null;
  readonly targetKwh: number;
  readonly baselineKwh: number;
  readonly profile: ProfileSummary;
  readonly explore: ExploreModel;
}

export function buildActionsViewModel(data: HouseholdData): ActionsViewModel {
  const baseline = latestUsage(data)?.kwh ?? 300;
  const profile = summarise(data.profile);
  const suggested = suggestedActions(profile.archetype, getActiveFactor(), data.profile);
  const stateById = new Map(data.actions.map((action) => [action.actionId, action.state]));
  const actions: ActionView[] = suggested
    .filter((action) => stateById.get(action.id) !== "dismissed")
    .map((action) => ({ ...action, state: stateById.get(action.id) ?? "suggested" }));

  const doneCount = actions.filter((action) => action.state === "done").length;
  const remainingCount = actions.length - doneCount;
  const suggestedCount = actions.filter((action) => action.state === "suggested").length;
  const goal = householdGoal(data.usage.map((record) => record.kwh));

  return {
    actions,
    doneCount,
    remainingCount: Math.max(0, remainingCount),
    suggestedCount,
    completedPercent: actions.length === 0 ? 0 : Math.round((doneCount / actions.length) * 100),
    potential: planPotential(actions, baseline),
    goal,
    targetKwh: goal?.kwh ?? 0,
    baselineKwh: baseline,
    profile,
    explore: buildExploreModel({
      profile: data.profile,
      factor: getActiveFactor(),
      actionStates: data.actions,
    }),
  };
}

export interface JourneyActionSummary {
  readonly id: string;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly state: HouseholdActionState;
  readonly category: string;
  readonly effort: number;
  readonly updatedAt: string | null;
  readonly evidenceVersion: string;
}

export interface JourneyMilestoneView {
  readonly id: string;
  readonly label: "Provisional" | "Confirmed";
  readonly goalKwh: number;
  readonly achievedKwh: number;
  readonly occurredAt: string;
  readonly isDemo: boolean;
}

export interface JourneyViewModel {
  readonly trend: TrendSummary;
  readonly events: readonly JourneyEvent[];
  readonly milestones: readonly JourneyMilestoneView[];
  readonly completedActions: readonly JourneyActionSummary[];
  readonly openActions: readonly JourneyActionSummary[];
  readonly nextStep: JourneyNextStep;
  readonly goal: HouseholdGoal | null;
  readonly goalProgressPct: number | null;
  readonly isDemo: boolean;
  readonly hasStoredEstimates: boolean;
}

export function buildJourneyViewModel(data: HouseholdData): JourneyViewModel {
  const energy = buildEnergyViewModel(data);
  const actionsView = buildActionsViewModel(data);

  const periodInputs: JourneyPeriodInput[] = energy.periods.map((period) => ({
    id: period.id,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    kwh: period.kwh,
    flatKg: period.flatKg,
    modelledKg: period.modelledKg,
    source: period.source,
    confirmedAt: period.confirmedAt,
    isDemo: period.isDemo,
    factorId: period.factorId,
    factorKgPerKwh: period.factorKgPerKwh,
    modelId: period.modelId,
    estimateStored: period.estimateStored,
  }));
  const trend = summariseTrend(periodInputs);

  const stateById = new Map(data.actions.map((action) => [action.actionId, action]));
  const actionSummary = actionsView.actions.map<JourneyActionSummary>((action) => ({
    id: action.id,
    title: action.title,
    shortTitle: action.shortTitle,
    description: action.description,
    state: action.state,
    category: action.category,
    effort: action.effort,
    updatedAt: stateById.get(action.id)?.updatedAt ?? null,
    evidenceVersion: action.evidenceVersion,
  }));

  const milestones: JourneyMilestoneView[] = [...data.milestones]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((milestone) => ({
      id: milestone.id,
      label: milestone.label,
      goalKwh: milestone.goalKwh,
      achievedKwh: milestone.achievedKwh,
      occurredAt: milestone.occurredAt,
      isDemo: milestone.isDemo,
    }));

  const events = buildJourneyEvents({
    periods: trend.periods,
    milestones: milestones.map((milestone) => ({
      id: milestone.id,
      kind: "goal_reached",
      label: `${milestone.label} goal reached`,
      detail: `${milestone.achievedKwh} kWh recorded against a ${milestone.goalKwh} kWh goal.`,
      occurredAt: milestone.occurredAt,
      isDemo: milestone.isDemo,
    })),
    actions: actionSummary.map((action) => ({
      id: action.id,
      title: action.title,
      shortTitle: action.shortTitle,
      state: action.state,
      updatedAt: action.updatedAt,
    })),
  });

  const completedActions = actionSummary.filter((action) => action.state === "done");
  const openActions = actionSummary.filter((action) => action.state !== "done");

  const nextStep = selectNextStep({
    billCount: trend.periods.length,
    hasGoal: energy.goal !== null,
    actions: actionSummary.map((action) => ({
      id: action.id,
      title: action.title,
      shortTitle: action.shortTitle,
      description: action.description,
      state: action.state,
      effort: action.effort as 1 | 2 | 3,
    })),
  });

  return {
    trend,
    events,
    milestones,
    completedActions,
    openActions,
    nextStep,
    goal: energy.goal,
    goalProgressPct: goalProgress(energy.goal?.kwh ?? null, energy.current?.kwh ?? null),
    isDemo: energy.isDemo,
    hasStoredEstimates: energy.periods.length > 0 && energy.periods.every((period) => period.estimateStored),
  };
}
