import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, forbiddenOrigin } from "@/lib/csrf";
import { readSession } from "@/lib/session";
import { loadHousehold } from "@/lib/household-store";
import { scenario } from "@/domain/community";
import { getActiveFactor } from "@/domain/carbon/factors";
import { ensureSession } from "@/lib/session";

const schema = z.object({
  households: z.number().int().min(10).max(2000),
  reductionPct: z.number().min(1).max(25),
  baselineKwh: z.number().min(150).max(600),
});

/** Scenario is a pure function: nothing is persisted and nothing enters aggregates. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_scenario",
          message: "Households must be 10–2,000, reduction 1–25%, baseline 150–600 kWh.",
        },
      },
      { status: 422 },
    );
  }

  const session = await readSession();
  if (session) await loadHousehold(session.householdId, false);
  else await ensureSession();

  const factor = getActiveFactor();
  const result = scenario({ ...parsed.data, factor });
  return NextResponse.json({
    ok: true,
    data: {
      ...result,
      label: "Scenario",
      factor: { id: factor.id, kgPerKwh: factor.kgPerKwh, year: factor.year, status: factor.status },
    },
  });
}
