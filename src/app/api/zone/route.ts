import { NextResponse } from "next/server";
import { getActiveFactor } from "@/domain/carbon/factors";
import { zoneStats } from "@/domain/zone";
import { hydrateConsentedCohort, listConsentedCohort } from "@/lib/community-store";
import { demoCohort } from "@/db/demo";
import { DEMO_MODE } from "@/lib/config";
import type { CohortRecord } from "@/domain/community";

/**
 * Zone aggregate read. Public by design (D21): viewing does not require consent.
 * A zone below k returns the gate state and no numeric fields.
 */
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

  const result = zoneStats(zoneId, rows, getActiveFactor(), {
    namespace: useDemo ? "demo" : "real",
  });

  return NextResponse.json({
    ok: true,
    data: {
      zoneId,
      namespace: useDemo ? "demo" : "real",
      suppressed: result.suppressed,
      reason: result.suppressed ? result.reason : null,
      kThreshold: result.kThreshold,
      stats: result.suppressed ? null : result,
    },
  });
}
