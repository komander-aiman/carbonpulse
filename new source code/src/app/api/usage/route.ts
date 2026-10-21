import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, forbiddenOrigin } from "@/lib/csrf";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rate-limit";
import { ensureSession } from "@/lib/session";
import { loadHousehold, saveUsagePersistent } from "@/lib/household-store";
import { buildEnergyViewModel } from "@/lib/view-model";

const usageSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kwh: z.number().min(1).max(3000),
  // `source` is deliberately absent: accepting it from the client would let a
  // caller label typed input as "csv", overstating how the value was derived.
  // Unknown keys are stripped, and the route sets the source itself.
});

export async function GET() {
  const session = await ensureSession();
  const data = await loadHousehold(session.householdId, false);
  return NextResponse.json({ ok: true, data: buildEnergyViewModel(data) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = rateLimit(clientKey(request, 'usage'), 20, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit);

  const body = await request.json().catch(() => null);
  const parsed = usageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_input",
          message: "Check the billing period and kWh value.",
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
          ),
        },
      },
      { status: 422 },
    );
  }

  const session = await ensureSession();
  const result = await saveUsagePersistent(session.householdId, { ...parsed.data, source: "manual" });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: result.code, message: result.message } },
      { status: 422 },
    );
  }
  const data = await loadHousehold(session.householdId, false);
  return NextResponse.json({ ok: true, data: buildEnergyViewModel(data) }, { status: 201 });
}
