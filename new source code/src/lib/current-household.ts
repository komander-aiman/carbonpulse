import "server-only";

import { readSession } from "@/lib/session";
import { ensureHousehold, getHousehold, type HouseholdData } from "@/lib/household-store";
import { DEMO_HOUSEHOLD } from "@/db/demo";

export const DEMO_SESSION_ID = DEMO_HOUSEHOLD.id;

/**
 * Resolves the household for a read. With no signed session yet the demo
 * household is shown, so every route renders before the visitor interacts.
 * Cookies cannot be set during a render, so the real session starts on the
 * first mutation (see /api/households and the usage routes).
 */
export async function currentHousehold(): Promise<HouseholdData> {
  const session = await readSession();
  const householdId = session?.householdId ?? DEMO_SESSION_ID;
  return getHousehold(householdId) ?? ensureHousehold(householdId, true);
}

/** Id of the household data currently displayed, for form submissions. */
export async function currentHouseholdId(): Promise<string> {
  const session = await readSession();
  return session?.householdId ?? DEMO_SESSION_ID;
}
