import { NextResponse } from "next/server";
import { currentHouseholdId } from "@/lib/current-household";
import { buildCommunityViewModel } from "@/lib/community-view";
import { loadHousehold } from "@/lib/household-store";

/**
 * Zone read. Every household-scoped value is resolved from the signed session;
 * the query never accepts a household id, so cross-household reads are
 * impossible. Viewing is public (D21): consent gates contribution only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const township = url.searchParams.get("township") ?? "elmina";
  const useDemo = url.searchParams.get("demo") === "true";
  const householdId = await currentHouseholdId();
  const data = await loadHousehold(householdId, false);

  const view = await buildCommunityViewModel(data, { useDemo, township });
  const zone = view.zone;

  return NextResponse.json({
    ok: true,
    data: {
      township: view.township,
      namespace: view.namespace,
      demo: view.isDemoData,
      zoneId: view.zoneId,
      suppressed: zone.suppressed,
      reason: zone.suppressed ? zone.reason : null,
      minimumCohort: view.minimumCohort,
      stats: zone.suppressed ? null : zone,      band: view.band,
      sharedGoal: view.sharedGoal.suppressed ? null : view.sharedGoal,
      zones: view.zones.map((entry) => ({
        id: entry.id,
        name: entry.name,
        suppressed: entry.result.suppressed,
        stats: entry.result.suppressed ? null : entry.result,
      })),
      consented: view.consentGranted,
    },
  });
}
