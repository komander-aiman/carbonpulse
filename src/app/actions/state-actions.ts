"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureSession } from "@/lib/session";
import { setActionStatePersistent } from "@/lib/household-store";
import type { HouseholdActionState } from "@/domain/actions";

const schema = z.object({
  actionId: z.string().min(1).max(64),
  state: z.enum(["suggested", "done", "snoozed", "dismissed"]),
});

export async function updateActionState(input: {
  actionId: string;
  state: HouseholdActionState;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown action." };

  const session = await ensureSession();
  await setActionStatePersistent(session.householdId, parsed.data.actionId, parsed.data.state);
  revalidatePath("/actions");
  revalidatePath("/journey");
  revalidatePath("/");
  return { ok: true };
}
