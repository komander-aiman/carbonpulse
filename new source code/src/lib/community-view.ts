import "server-only";

import { getActiveFactor } from "@/domain/carbon/factors";
import { cohortStats, coarseBand, type CohortRecord, type CohortResult } from "@/domain/community";
import { DEMO_COHORT_SIZE, demoCohort } from "@/db/demo";
import { SUBZONES } from "@/db/geo";
import { hydrateConsentedCohort, listConsentedCohort } from "@/lib/community-store";
import { DEMO_MODE } from "@/lib/config";

export interface SubzoneStat {
  readonly id: string;
  readonly name: string;
  readonly result: CohortResult;
}

export interface CommunityViewModel {
  readonly township: string;
  readonly isDemoData: boolean;
  readonly overall: CohortResult;
  readonly subzones: readonly SubzoneStat[];
  readonly band: ReturnType<typeof coarseBand>;
  readonly householdKwh: number | null;
  readonly consentGranted: boolean;
  readonly minimumCohort: number;
}

function toRecords(
  rows: ReturnType<typeof demoCohort>,
  township: string,
): CohortRecord[] {
  return rows.filter((row) => row.township === township);
}

export async function buildCommunityViewModel(
  householdId: string,
  householdKwh: number | null,
  consentGranted: boolean,
  township = "elmina",
): Promise<CommunityViewModel> {
  const factor = getActiveFactor("peninsular");
  await hydrateConsentedCohort();

  // The viewer is part of their own cohort. Excluding them meant a cohort of
  // exactly k = 10 consenting households showed "suppressed" to every member,
  // because each saw only the other nine. Suppression is about the group being
  // large enough, and the group includes the person looking at it.
  const realRows = listConsentedCohort().filter(
    (row) => row.township === township && !row.isDemo,
  );

  const useDemo = DEMO_MODE && realRows.length < 10;
  const namespace = useDemo ? "demo" : "real";
  const records: CohortRecord[] = useDemo ? toRecords(demoCohort(), township) : realRows;

  const overall = cohortStats(records, factor, { namespace });
  const subzones: SubzoneStat[] = SUBZONES.map((subzone) => {
    const rows = records.filter((record) => record.subzone === subzone.id);
    return { id: subzone.id, name: subzone.name, result: cohortStats(rows, factor, { namespace }) };
  });

  return {
    township,
    isDemoData: useDemo,
    overall,
    subzones,
    band: householdKwh !== null ? coarseBand(householdKwh, overall) : "suppressed",
    householdKwh,
    consentGranted,
    minimumCohort: 10,
  };
}

export { DEMO_COHORT_SIZE };
