import "server-only";

import { getActiveFactor } from "@/domain/carbon/factors";
import { zoneStats } from "@/domain/zone";
import { householdGoal } from "@/domain/goal";
import { sharedGoal } from "@/domain/shared-goal";
import { MIN_COHORT_SIZE, type CohortRecord } from "@/domain/community";
import { SUBZONES } from "@/db/geo";
import { hydrateConsentedCohort, listConsentedCohort } from "@/lib/community-store";
import { supabaseAdmin } from "@/lib/supabase";

export interface RebuiltZone {
  readonly zoneId: string;
  readonly suppressed: boolean;
  readonly householdCount: number | null;
  readonly sharedProgressPct: number | null;
}

export interface RebuildReport {
  readonly period: string;
  readonly kThreshold: number;
  readonly zones: readonly RebuiltZone[];
  readonly published: number;
  readonly suppressed: number;
  readonly persisted: boolean;
}

/**
 * Recomputes every zone snapshot for one period. Snapshots are inserted, never
 * updated in place, so a published aggregate is immutable once written.
 *
 * This runs the same domain functions the UI reads, so a job and a request can
 * never disagree about the k gate or the rounding rule.
 */
export async function rebuildZones(period = defaultPeriod(), options: { readonly persist?: boolean } = {}): Promise<RebuildReport> {
  const factor = getActiveFactor();
  await hydrateConsentedCohort();
  const rows = listConsentedCohort();
  const canPersist = (options.persist ?? true) && Boolean(supabaseAdmin());

  const zones: RebuiltZone[] = SUBZONES.map((subzone) => {
    const zoneRows: CohortRecord[] = rows.filter((row) => row.subzone === subzone.id);
    const result = zoneStats(subzone.id, zoneRows, factor, { namespace: "real" });
    if (result.suppressed) {
      return {
        zoneId: subzone.id,
        suppressed: true,
        householdCount: null,
        sharedProgressPct: null,
      };
    }
    const goals = zoneRows.map((row) => householdGoal([row.kwh])).filter((goal) => goal !== null);
    const shared = sharedGoal({
      zoneId: subzone.id,
      goals,
      referenceKwh: zoneRows.map((row) => row.kwh),
      currentKwh: zoneRows.map((row) => row.kwh),
      zone: result,
    });
    return {
      zoneId: subzone.id,
      suppressed: false,
      householdCount: result.householdCount,
      sharedProgressPct: shared.suppressed ? null : shared.progressPct,
    };
  });

  if (canPersist) {
    await persistSnapshots(zones, rows, period, factor.id);
  }

  return {
    period,
    kThreshold: MIN_COHORT_SIZE,
    zones,
    published: zones.filter((zone) => !zone.suppressed).length,
    suppressed: zones.filter((zone) => zone.suppressed).length,
    persisted: canPersist,
  };
}

function defaultPeriod(): string {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return first.toISOString().slice(0, 10);
}

async function persistSnapshots(
  zones: readonly RebuiltZone[],
  rows: readonly CohortRecord[],
  period: string,
  factorVersionId: string,
): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: township, error: townshipError } = await db
    .from("township")
    .select("id")
    .eq("slug", "elmina")
    .single();
  if (townshipError) throw new Error(`Supabase township read failed: ${townshipError.message}`);

  const { data: subzones, error: subzoneError } = await db
    .from("subzone")
    .select("id,slug")
    .eq("township_id", township.id);
  if (subzoneError) throw new Error(`Supabase subzone read failed: ${subzoneError.message}`);

  const bySlug = new Map((subzones as { id: string; slug: string }[]).map((row) => [row.slug, row.id]));
  const factor = getActiveFactor();

  const inserts = zones.flatMap((zone) => {
    const subzoneId = bySlug.get(zone.zoneId);
    if (!subzoneId) return [];
    if (zone.suppressed) {
      return [
        {
          township_id: township.id,
          subzone_id: subzoneId,
          period,
          factor_version_id: factorVersionId,
          namespace: "real" as const,
          suppressed: true,
          k_threshold: MIN_COHORT_SIZE,
        },
      ];
    }

    const zoneRows = rows.filter((row) => row.subzone === zone.zoneId);
    const result = zoneStats(zone.zoneId, zoneRows, factor, { namespace: "real" });
    if (result.suppressed) return [];
    const goals = zoneRows.map((row) => householdGoal([row.kwh])).filter((goal) => goal !== null);
    const shared = sharedGoal({
      zoneId: zone.zoneId,
      goals,
      referenceKwh: zoneRows.map((row) => row.kwh),
      currentKwh: zoneRows.map((row) => row.kwh),
      zone: result,
    });

    return [
      {
        township_id: township.id,
        subzone_id: subzoneId,
        period,
        household_count: result.householdCount,
        median_kwh: result.medianKwh,
        p25_kwh: result.p25Kwh,
        p75_kwh: result.p75Kwh,
        p33_kwh: result.p33Kwh,
        p67_kwh: result.p67Kwh,
        median_kg_co2e: result.medianKgCo2e,
        coverage_pct: result.coveragePct,
        shared_goal_kwh: shared.suppressed ? null : shared.targetKwh,
        shared_reference_kwh: shared.suppressed ? null : shared.referenceKwh,
        shared_current_kwh: shared.suppressed ? null : shared.currentKwh,
        progress_pct: shared.suppressed ? null : shared.progressPct,
        factor_version_id: factorVersionId,
        namespace: "real" as const,
        suppressed: false,
        k_threshold: MIN_COHORT_SIZE,
      },
    ];
  });

  if (inserts.length === 0) return;
  const { error } = await db.from("zone_snapshot").insert(inserts);
  if (error) throw new Error(`Supabase zone snapshot insert failed: ${error.message}`);
}
