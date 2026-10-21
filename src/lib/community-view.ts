import "server-only";

import { getActiveFactor } from "@/domain/carbon/factors";
import { MIN_COHORT_SIZE, type CohortRecord, type CohortResult } from "@/domain/community";
import { zoneStats, zoneBand, type ZoneResult } from "@/domain/zone";
import { compareWithSimilarHomes, type Comparison } from "@/domain/comparison";
import { sharedGoal, type SharedGoalResult } from "@/domain/shared-goal";
import { householdGoal } from "@/domain/goal";
import { summarise, type ProfileSummary } from "@/domain/profile";
import { DEMO_COHORT_SIZE, demoCohort } from "@/db/demo";
import { SUBZONES } from "@/db/geo";
import { hydrateConsentedCohort, listComparableHouseholds, listConsentedCohort } from "@/lib/community-store";
import { DEMO_MODE } from "@/lib/config";
import { latestUsage, trailingKwh, type HouseholdData } from "@/lib/household-store";

export interface ZoneStat {
  readonly id: string;
  readonly name: string;
  readonly result: ZoneResult;
}

export interface CommunityViewModel {
  readonly township: string;
  readonly namespace: "real" | "demo";
  readonly isDemoData: boolean;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly zone: ZoneResult;
  readonly zones: readonly ZoneStat[];
  readonly band: ReturnType<typeof zoneBand>;
  readonly householdKwh: number | null;
  readonly consentGranted: boolean;
  readonly minimumCohort: number;
  readonly sharedGoal: SharedGoalResult;
  readonly comparison: Comparison;
  readonly profile: ProfileSummary;
}

function toCohortRows(rows: ReturnType<typeof demoCohort>): CohortRecord[] {
  return rows.map((row) => ({
    householdId: row.householdId,
    kwh: row.kwh,
    consented: row.consented,
    isDemo: row.isDemo,
    confirmed: row.confirmed,
    township: row.township,
    subzone: row.subzone,
  }));
}

export function zoneNameOf(id: string): string {
  return SUBZONES.find((subzone) => subzone.id === id)?.name ?? id;
}

/**
 * Builds the whole community view. The demo namespace is used only when demo
 * mode is ON and the caller opted in via the explicit toggle; a real zone below
 * k is never filled with demo rows.
 */
export async function buildCommunityViewModel(
  data: HouseholdData,
  options: { readonly useDemo?: boolean; readonly township?: string } = {},
): Promise<CommunityViewModel> {
  const factor = getActiveFactor("peninsular");
  const township = options.township ?? "elmina";
  await hydrateConsentedCohort();

  const realRows = listConsentedCohort().filter(
    (row) => (row.township ?? township) === township && !row.isDemo,
  );
  const useDemo = (options.useDemo ?? false) && DEMO_MODE;
  const namespace = useDemo ? "demo" : "real";

  const records: CohortRecord[] = useDemo ? toCohortRows(demoCohort()) : realRows;
  const comparableRecords = useDemo
    ? demoCohort().map((row) => ({
        householdId: row.householdId,
        kwh: row.kwh,
        consented: row.consented,
        isDemo: row.isDemo,
        confirmed: row.confirmed,
        township: row.township,
        subzone: row.subzone,
        bandKey: row.bandKey,
      }))
    : listComparableHouseholds();

  const current = latestUsage(data);
  const householdKwh = current?.kwh ?? null;
  const profile = summarise(data.profile);
  const zoneId = data.household.subzone;

  const zones: ZoneStat[] = SUBZONES.map((subzone) => {
    const rows = records.filter((record) => record.subzone === subzone.id);
    return { id: subzone.id, name: subzone.name, result: zoneStats(subzone.id, rows, factor, { namespace }) };
  });
  const zone = zoneStats(zoneId, records, factor, { namespace });

  const zoneRows = records.filter((record) => record.subzone === zoneId);
  const goals = zoneRows.map((row) => householdGoal([row.kwh])).filter((goal) => goal !== null);
  const shared = sharedGoal({
    zoneId,
    goals,
    referenceKwh: zoneRows.map((row) => row.kwh),
    currentKwh: [householdKwh ?? 0],
    zone,
  });

  const comparison = compareWithSimilarHomes({
    viewer: {
      householdId: data.household.id,
      kwh: householdKwh ?? 0,
      subzone: zoneId,
      township,
      bandKey: profile.band?.key ?? null,
    },
    records: comparableRecords,
    factor,
    namespace,
  });

  return {
    township,
    namespace,
    isDemoData: useDemo,
    zoneId,
    zoneName: zoneNameOf(zoneId),
    zone,
    zones,
    band: householdKwh !== null ? zoneBand(householdKwh, zone) : "suppressed",
    householdKwh,
    consentGranted: data.consents.filter((consent) => consent.scope === "aggregation").at(-1)?.granted ?? false,
    minimumCohort: MIN_COHORT_SIZE,
    sharedGoal: shared,
    comparison,
    profile,
  };
}

export interface OverviewCommunityTeaser {
  readonly suppressed: boolean;
  readonly zoneName: string;
  readonly band: CohortResult | ZoneResult;
}

export { DEMO_COHORT_SIZE };
export function trailingForGoal(data: HouseholdData): number[] {
  return trailingKwh(data, 3);
}
