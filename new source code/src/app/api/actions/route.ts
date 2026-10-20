import { NextResponse } from "next/server";
import { ensureSession } from "@/lib/session";
import { ensureHousehold, getHousehold, setActionState } from "@/lib/household-store";
import { buildActionsViewModel } from "@/lib/view-model";
import { z } from "zod";

const schema = z.object({
  actionId: z.string().min(1).max(64),
  state: z.enum(["suggested", "done", "snoozed", "dismissed"]),
});

export async function GET() {
  const session = await ensureSession();
  const data = ensureHousehold(session.householdId, true);
  return NextResponse.json({ ok: true, data: buildActionsViewModel(data) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_action", message: "Unknown action or state." } },
      { status: 422 },
    );
  }
  const session = await ensureSession();
  ensureHousehold(session.householdId, true);
  setActionState(session.householdId, parsed.data.actionId, parsed.data.state);
  const data = getHousehold(session.householdId);
  return NextResponse.json({ ok: true, data: data ? buildActionsViewModel(data) : null });
}
