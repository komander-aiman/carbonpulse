import "server-only";

import { readSession } from "@/lib/session";
import { ensureHousehold, getHousehold, type HouseholdData } from "@/lib/household-store";
import { DEMO_HOUSEHOLD } from "@/db/demo";
import { DEMO_MODE } from "@/lib/config";

export const DEMO_SESSION_ID = DEMO_HOUSEHOLD.id;

/**
 * Resolves the household for a read. With no signed session the demo household
 * is shown only while demo mode is on; otherwise the caller gets an empty real
 * household so the app renders a genuine first-run state.
 */
export async function currentHousehold(): Promise<HouseholdData> {
  const session = await readSession();
  const householdId = session?.householdId ?? DEMO_SESSION_ID;
  return getHousehold(householdId) ?? ensureHousehold(householdId, DEMO_MODE);
}

/** Id of the household data currently displayed, for form submissions. */
export async function currentHouseholdId(): Promise<string> {
  const session = await readSession();
  return session?.householdId ?? DEMO_SESSION_ID;
}
