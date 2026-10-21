import { NextResponse } from "next/server";
import { ensureSession } from "@/lib/session";
import { loadHousehold, setActionStatePersistent } from "@/lib/household-store";
import { buildActionsViewModel } from "@/lib/view-model";
import { z } from "zod";
import { isSameOrigin, forbiddenOrigin } from "@/lib/csrf";

const schema = z.object({
  actionId: z.string().min(1).max(64),
  state: z.enum(["suggested", "done", "snoozed", "dismissed"]),
});

export async function GET() {
  const session = await ensureSession();
  const data = await loadHousehold(session.householdId, false);
  return NextResponse.json({ ok: true, data: buildActionsViewModel(data) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_action", message: "Unknown action or state." } },
      { status: 422 },
    );
  }
  const session = await ensureSession();
  await setActionStatePersistent(session.householdId, parsed.data.actionId, parsed.data.state);
  const data = await loadHousehold(session.householdId, false);
  return NextResponse.json({ ok: true, data: buildActionsViewModel(data) });
}
