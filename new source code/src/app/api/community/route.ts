import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { currentHouseholdId } from "@/lib/current-household";
import { buildCommunityViewModel } from "@/lib/community-view";
import { getConsent, getHousehold, latestUsage } from "@/lib/household-store";

/**
 * Cohort read. Every household-scoped value is resolved from the signed session;
 * the query never accepts a household id, so cross-household reads are impossible.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const township = url.searchParams.get("township") ?? "elmina";
  const session = await readSession();
  const householdId = await currentHouseholdId();
  const data = getHousehold(householdId);
  const consent = getConsent(householdId, "aggregation");
  const current = data ? latestUsage(data) : null;

  const view = buildCommunityViewModel(
    session?.householdId ?? householdId,
    current?.kwh ?? null,
    consent?.granted ?? false,
    township,
  );

  return NextResponse.json({
    ok: true,
    data: {
      township: view.township,
      demo: view.isDemoData,
      suppressed: view.overall.suppressed,
      reason: view.overall.suppressed ? view.overall.reason : null,
      minimumCohort: view.minimumCohort,
      stats: view.overall.suppressed ? null : view.overall,
      band: view.band,
      subzones: view.subzones.map((subzone) => ({
        id: subzone.id,
        name: subzone.name,
        suppressed: subzone.result.suppressed,
        stats: subzone.result.suppressed ? null : subzone.result,
      })),
    },
  });
}
