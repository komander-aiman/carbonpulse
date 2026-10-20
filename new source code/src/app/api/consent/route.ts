import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSession } from "@/lib/session";
import { ensureHousehold, recordConsent, getConsent } from "@/lib/household-store";
import { syncHouseholdToCohort, removeFromCohort } from "@/lib/community-store";
import { CONSENT_POLICY_VERSION } from "@/lib/config";

const schema = z.object({
  scope: z.enum(["aggregation", "content"]).default("aggregation"),
  action: z.enum(["granted", "withdrawn"]),
});

export async function GET() {
  const session = await ensureSession();
  ensureHousehold(session.householdId, true);
  return NextResponse.json({
    ok: true,
    data: {
      aggregation: getConsent(session.householdId, "aggregation"),
      content: getConsent(session.householdId, "content"),
      policyVersion: CONSENT_POLICY_VERSION,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_consent", message: "Unknown consent scope or action." } },
      { status: 422 },
    );
  }

  const session = await ensureSession();
  ensureHousehold(session.householdId, true);
  const granted = parsed.data.action === "granted";
  const record = recordConsent(session.householdId, parsed.data.scope, granted, CONSENT_POLICY_VERSION);

  if (parsed.data.scope === "aggregation") {
    if (granted) syncHouseholdToCohort(session.householdId);
    else removeFromCohort(session.householdId);
  }

  return NextResponse.json({ ok: true, data: record });
}
