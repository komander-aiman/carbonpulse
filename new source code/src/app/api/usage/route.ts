import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSession } from "@/lib/session";
import { ensureHousehold, saveUsage, getHousehold } from "@/lib/household-store";
import { buildEnergyViewModel } from "@/lib/view-model";

const usageSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kwh: z.number().min(1).max(3000),
  source: z.enum(["manual", "csv", "derived"]).default("manual"),
});

export async function GET() {
  const session = await ensureSession();
  const data = getHousehold(session.householdId);
  if (!data) return NextResponse.json({ ok: false, error: { code: "not_found", message: "No household." } }, { status: 404 });
  return NextResponse.json({ ok: true, data: buildEnergyViewModel(data) });
}

export async function POST(request: Request) {
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
  ensureHousehold(session.householdId, true);
  const result = saveUsage(session.householdId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: { code: result.code, message: result.message } },
      { status: 422 },
    );
  }
  const data = getHousehold(session.householdId);
  return NextResponse.json({ ok: true, data: data ? buildEnergyViewModel(data) : null }, { status: 201 });
}
