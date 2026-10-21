import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, forbiddenOrigin } from "@/lib/csrf";
import { rateLimit, clientKey, tooManyRequests } from "@/lib/rate-limit";
import { ensureSession } from "@/lib/session";
import { loadHousehold, saveProfilePersistent } from "@/lib/household-store";
import { QUESTIONNAIRE_VERSION, summarise } from "@/domain/profile";

const schema = z.object({
  homeType: z.enum(["terrace", "apartment", "semi_d", "bungalow"]),
  householdSize: z.number().int().min(1).max(20),
  airconCount: z.number().int().min(0).max(20),
  occupancy: z.enum(["home_all_day", "out_weekdays", "evenings_only", "varies"]),
  coolingHours: z.enum(["none", "night", "evening", "all_day"]),
  waterHeating: z.enum(["none", "instant", "tank"]),
  evCharging: z.boolean(),
  appliances: z
    .array(z.enum(["fridge", "washer", "dryer", "dishwasher", "tv", "console", "water_pump"]))
    .default([]),
});

export async function GET() {
  const session = await ensureSession();
  const data = await loadHousehold(session.householdId, false);
  return NextResponse.json({
    ok: true,
    data: { profile: data.profile, summary: summarise(data.profile) },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const limit = rateLimit(clientKey(request, "questionnaire"), 30, 60 * 60 * 1000);
  if (!limit.allowed) return tooManyRequests(limit);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_profile", message: "Check the questionnaire answers." } },
      { status: 422 },
    );
  }

  const session = await ensureSession();
  const profile = await saveProfilePersistent(session.householdId, {
    ...parsed.data,
    version: QUESTIONNAIRE_VERSION,
  });

  return NextResponse.json({
    ok: true,
    data: { profile, summary: summarise(profile) },
  });
}
