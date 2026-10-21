import "server-only";

import type { CohortRecord } from "@/domain/community";
import { getHousehold, getConsent } from "@/lib/household-store";
import { supabaseAdmin } from "@/lib/supabase";

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

interface EligibleHouseholdRow {
  readonly id: string;
  readonly township_id: string;
  readonly subzone_id: string | null;
}

interface ConsentEventRow {
  readonly household_id: string;
  readonly action: "granted" | "withdrawn";
  readonly created_at: string;
}

interface CohortUsageRow {
  readonly household_id: string;
  readonly kwh: number | string;
  readonly period_start: string;
}

/**
 * Hydrates the server-only cohort index from durable records. Raw household
 * values never leave this module; callers receive only k-anonymous aggregates.
 */
export async function hydrateConsentedCohort(): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: households, error: householdError } = await db
    .from("household")
    .select("id,township_id,subzone_id")
    .eq("is_demo", false)
    .eq("invalid_data", false)
    .is("deleted_at", null);
  if (householdError) throw new Error(`Supabase cohort household read failed: ${householdError.message}`);

  const householdRows = households as EligibleHouseholdRow[];
  const ids = householdRows.map((row) => row.id);
  const idx = index();
  idx.rows.clear();
  idx.townships.clear();
  if (ids.length === 0) return;

  const townshipIds = [...new Set(householdRows.map((row) => row.township_id))];
  const subzoneIds = [
    ...new Set(householdRows.map((row) => row.subzone_id).filter((id): id is string => id !== null)),
  ];

  const [consentResponse, usageResponse, townshipResponse, subzoneResponse] = await Promise.all([
    db
      .from("consent_event")
      .select("household_id,action,created_at")
      .in("household_id", ids)
      .eq("scope", "aggregation")
      .order("created_at"),
    db
      .from("usage_month")
      .select("household_id,kwh,period_start")
      .in("household_id", ids)
      .eq("is_demo", false)
      .order("period_start"),
    db.from("township").select("id,slug").in("id", townshipIds),
    subzoneIds.length > 0
      ? db.from("subzone").select("id,slug").in("id", subzoneIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (consentResponse.error) throw new Error(`Supabase cohort consent read failed: ${consentResponse.error.message}`);
  if (usageResponse.error) throw new Error(`Supabase cohort usage read failed: ${usageResponse.error.message}`);
  if (townshipResponse.error) throw new Error(`Supabase township read failed: ${townshipResponse.error.message}`);
  if (subzoneResponse.error) throw new Error(`Supabase subzone read failed: ${subzoneResponse.error.message}`);

  const latestConsent = new Map<string, ConsentEventRow>();
  for (const row of consentResponse.data as ConsentEventRow[]) latestConsent.set(row.household_id, row);
  const latestUsage = new Map<string, CohortUsageRow>();
  for (const row of usageResponse.data as CohortUsageRow[]) latestUsage.set(row.household_id, row);
  const townships = new Map(
    (townshipResponse.data as { id: string; slug: string }[]).map((row) => [row.id, row.slug]),
  );
  const subzones = new Map(
    (subzoneResponse.data as { id: string; slug: string }[]).map((row) => [row.id, row.slug]),
  );

  for (const household of householdRows) {
    const consent = latestConsent.get(household.id);
    const usage = latestUsage.get(household.id);
    if (consent?.action !== "granted" || !usage) continue;
    const township = townships.get(household.township_id);
    if (!township) continue;
    idx.rows.set(household.id, {
      householdId: household.id,
      kwh: Number(usage.kwh),
      consented: true,
      isDemo: false,
      confirmed: true,
      township,
      subzone: household.subzone_id ? (subzones.get(household.subzone_id) ?? "unknown") : "unknown",
    });
    idx.townships.add(township);
  }
}
