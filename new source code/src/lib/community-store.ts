import "server-only";

import type { CohortRecord } from "@/domain/community";
import { getHousehold, getConsent } from "@/lib/household-store";

/**
 * Mirrors `v_public_cohort_stats`: only consented, non-demo, confirmed records
 * for the requested township are returned. This filter is the database view's
 * job in production and is duplicated here so no caller can bypass it.
 */
interface CohortRow {
  readonly householdId: string;
  readonly kwh: number;
  readonly consented: boolean;
  readonly isDemo: boolean;
  readonly confirmed: boolean;
  readonly township: string;
  readonly subzone: string;
}

interface CohortIndex {
  readonly townships: Set<string>;
  readonly rows: Map<string, CohortRow>;
}

const globalForCohort = globalThis as unknown as { __carbonpulseCohort?: CohortIndex };

function index(): CohortIndex {
  if (!globalForCohort.__carbonpulseCohort) {
    globalForCohort.__carbonpulseCohort = { townships: new Set(), rows: new Map() };
  }
  return globalForCohort.__carbonpulseCohort;
}

/** Re-reads the household's latest confirmed record into the cohort index. */
export function syncHouseholdToCohort(householdId: string): void {
  const data = getHousehold(householdId);
  if (!data) return;
  const consent = getConsent(householdId, "aggregation");
  const latest = data.usage.at(-1);
  const idx = index();

  if (!latest || !consent?.granted || data.household.isDemo || latest.isDemo) {
    idx.rows.delete(householdId);
    return;
  }

  idx.rows.set(householdId, {
    householdId,
    kwh: latest.kwh,
    consented: true,
    isDemo: false,
    confirmed: true,
    township: data.household.township,
    subzone: data.household.subzone,
  });
  idx.townships.add(data.household.township);
}

export function listConsentedCohort(): CohortRecord[] {
  return [...index().rows.values()].map((row) => ({ ...row }));
}

export function removeFromCohort(householdId: string): void {
  index().rows.delete(householdId);
}
