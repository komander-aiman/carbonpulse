import { NextResponse } from "next/server";
import { getActiveFactor } from "@/domain/carbon/factors";
import { compareWithSimilarHomes } from "@/domain/comparison";
import { summarise } from "@/domain/profile";
import { latestUsage } from "@/lib/household-store";
import { currentHouseholdId } from "@/lib/current-household";
import { loadHousehold } from "@/lib/household-store";
import { hydrateConsentedCohort, listComparableHouseholds } from "@/lib/community-store";
import { demoCohort } from "@/db/demo";
import { DEMO_MODE } from "@/lib/config";
import type { ComparableHousehold } from "@/domain/comparison";

/**
 * Similar-home comparison. Resolves the viewer from the signed session, so the
 * response can never be asked for another household's comparison.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const useDemo = url.searchParams.get("demo") === "true" && DEMO_MODE;
  const householdId = await currentHouseholdId();
  const data = await loadHousehold(householdId, false);
  const current = latestUsage(data);
  const profile = summarise(data.profile);

  await hydrateConsentedCohort();
  const rows: ComparableHousehold[] = useDemo
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

  const result = compareWithSimilarHomes({
    viewer: {
      householdId: data.household.id,
      kwh: current?.kwh ?? 0,
      subzone: data.household.subzone,
      township: data.household.township,
      bandKey: profile.band?.key ?? null,
    },
    records: rows,
    factor: getActiveFactor(),
    namespace: useDemo ? "demo" : "real",
  });

  return NextResponse.json({
    ok: true,
    data: { ...result, namespace: useDemo ? "demo" : "real" },
  });
}
