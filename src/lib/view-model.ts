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
import { summarise, type ProfileSummary } from "@/domain/profile";
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
  readonly flatKg: number;
  readonly modelledKg: number;
  readonly deltaKg: number;
  readonly deltaPct: number;
  readonly source: UsageRecord["source"];
  readonly confirmedAt: string;
  readonly isDemo: boolean;
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
}

export function buildEnergyViewModel(data: HouseholdData): EnergyViewModel {
  const factor = getActiveFactor("peninsular");
  const profile = buildIntensityProfile();
  const householdProfile = summarise(data.profile);

  const periods: PeriodView[] = data.usage.map((record) => {
    const modelled = modelledEstimate({
      kwh: record.kwh,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      archetype: householdProfile.archetype,
      factor,
      intensity: profile,
    });
    return {
      id: record.id,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      label: formatMonthLabel(record.periodStart),
      kwh: record.kwh,
      flatKg: roundKg(flatEstimate(record.kwh, factor).kgCo2e),
      modelledKg: roundKg(modelled.kgCo2e),
      deltaKg: roundKg(modelled.deltaKg),
      deltaPct: modelled.deltaPct,
      source: record.source,
      confirmedAt: record.confirmedAt,
      isDemo: record.isDemo,
    };
  });

  const currentRecord = latestUsage(data);
  const previousRecord = previousUsage(data);
  const current = periods.find((period) => period.id === currentRecord?.id) ?? null;
  const previous = periods.find((period) => period.id === previousRecord?.id) ?? null;

  const goal = householdGoal(data.usage.map((record) => record.kwh));
  const flat = currentRecord ? flatEstimate(currentRecord.kwh, factor) : null;
  const modelled = currentRecord
    ? modelledEstimate({
        kwh: currentRecord.kwh,
        periodStart: currentRecord.periodStart,
        periodEnd: currentRecord.periodEnd,
        archetype: householdProfile.archetype,
        factor,
        intensity: profile,
      })
    : null;

  const targetKwh = goal?.kwh ?? 0;
  return {
    household: data.household,
    periods,
    current,
    previous,
    goal,
    targetKwh,
    targetGapKwh: current && targetKwh > 0 ? Math.max(0, current.kwh - targetKwh) : 0,
    flatKg: flat ? roundKg(flat.kgCo2e) : 0,
    modelledKg: modelled ? roundKg(modelled.kgCo2e) : 0,
    deltaKg: modelled ? roundKg(modelled.deltaKg) : 0,
    deltaPct: modelled?.deltaPct ?? 0,
    factor,
    modelId: profile.modelVersion.id,
    calibrationDate: profile.modelVersion.calibrationDate,
    isDemo: data.household.isDemo || data.usage.every((record) => record.isDemo),
    hasRealRecords: data.usage.some((record) => !record.isDemo),
    profile: householdProfile,
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
  };
}
