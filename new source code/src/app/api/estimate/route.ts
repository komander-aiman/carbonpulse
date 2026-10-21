import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, forbiddenOrigin } from "@/lib/csrf";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rate-limit";
import { ensureSession } from "@/lib/session";
import { ensureHousehold, getHousehold } from "@/lib/household-store";
import { flatEstimate, modelledEstimate } from "@/domain/carbon/estimates";
import { getActiveFactor } from "@/domain/carbon/factors";
import { buildIntensityProfile } from "@/domain/carbon/intensity";

const schema = z.object({
  kwh: z.number().min(1).max(3000),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  archetype: z.enum(["ac_evening", "ac_all_day", "workday_absent", "mixed"]).optional(),
});

/**
 * Server-side estimate. The client never computes a displayed emission value;
 * this route is the only place the two numbers are produced.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = rateLimit(clientKey(request, 'estimate'), 60, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_input", message: "Inspect kWh and billing period." } },
      { status: 422 },
    );
  }

  const session = await ensureSession();
  const data = ensureHousehold(session.householdId);
  const factor = getActiveFactor();
  const profile = buildIntensityProfile();

  try {
    const flat = flatEstimate(parsed.data.kwh, factor);
    const modelled = modelledEstimate({
      ...parsed.data,
      archetype: parsed.data.archetype ?? (data.household.archetype as never),
      factor,
      intensity: profile,
    });

    return NextResponse.json({
      ok: true,
      data: {
        flat: { kgCo2e: flat.kgCo2e, label: flat.label },
        modelled: {
          kgCo2e: modelled.kgCo2e,
          deltaKg: modelled.deltaKg,
          deltaPct: modelled.deltaPct,
          rangeLow: modelled.kgCo2e * 0.85,
          rangeHigh: modelled.kgCo2e * 1.15,
          label: modelled.label,
        },
        factor: {
          id: factor.id,
          year: factor.year,
          kgPerKwh: factor.kgPerKwh,
          status: factor.status,
          sourceId: factor.sourceId,
        },
        model: { id: profile.modelVersion.id, calibrationDate: profile.modelVersion.calibrationDate },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "estimate_failed",
          message: error instanceof Error ? error.message : "The estimate could not be computed.",
        },
      },
      { status: 422 },
    );
  }
}

export async function GET() {
  const session = await ensureSession();
  const data = getHousehold(session.householdId);
  if (!data) return NextResponse.json({ ok: true, data: [] });
  const factor = getActiveFactor();
  const profile = buildIntensityProfile();
  return NextResponse.json({
    ok: true,
    data: data.usage.map((record) => ({
      periodStart: record.periodStart,
      kwh: record.kwh,
      flatKg: flatEstimate(record.kwh, factor).kgCo2e,
      modelledKg: modelledEstimate({
        kwh: record.kwh,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        archetype: data.household.archetype as never,
        factor,
        intensity: profile,
      }).kgCo2e,
    })),
  });
}
