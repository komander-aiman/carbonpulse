import { NextResponse } from "next/server";
import { getActiveFactor } from "@/domain/carbon/factors";
import { zoneStats } from "@/domain/zone";
import { householdGoal } from "@/domain/goal";
import { sharedGoal } from "@/domain/shared-goal";
import { hydrateConsentedCohort, listConsentedCohort } from "@/lib/community-store";
import { demoCohort } from "@/db/demo";
import { DEMO_MODE } from "@/lib/config";
import type { CohortRecord } from "@/domain/community";

/** Shared-goal read. Published only when the zone itself publishes. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zone") ?? "elmina-central";
  const useDemo = url.searchParams.get("demo") === "true" && DEMO_MODE;

  await hydrateConsentedCohort();
  const rows: CohortRecord[] = useDemo
    ? demoCohort().map((row) => ({
        householdId: row.householdId,
        kwh: row.kwh,
        consented: row.consented,
        isDemo: row.isDemo,
        confirmed: row.confirmed,
        township: row.township,
        subzone: row.subzone,
      }))
    : listConsentedCohort();

  const zone = zoneStats(zoneId, rows, getActiveFactor(), {
    namespace: useDemo ? "demo" : "real",
  });
  const zoneRows = rows.filter((row) => row.subzone === zoneId && row.consented && row.confirmed);
  const goals = zoneRows.map((row) => householdGoal([row.kwh])).filter((goal) => goal !== null);
  const result = sharedGoal({
    zoneId,
    goals,
    referenceKwh: zoneRows.map((row) => row.kwh),
    currentKwh: zoneRows.map((row) => row.kwh),
    zone,
  });

  return NextResponse.json({
    ok: true,
    data: {
      ...result,
      namespace: useDemo ? "demo" : "real",
    },
  });
}
