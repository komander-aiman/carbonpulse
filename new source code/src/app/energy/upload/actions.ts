"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { ensureSession, sessionCookie } from "@/lib/session";
import { rateLimit, sessionKey } from "@/lib/rate-limit";
import { ensureHousehold, saveUsage, recordConsent } from "@/lib/household-store";
import { parseIntervalCsv, validateIntervals, intervalEstimate } from "@/domain/carbon/interval";
import { CONSENT_POLICY_VERSION } from "@/lib/config";
import { saveImport } from "@/lib/interval-store";
import { syncHouseholdToCohort } from "@/lib/community-store";

const MAX_BYTES = 5 * 1024 * 1024;

export interface FormState {
  readonly ok: boolean;
  readonly message: string;
  readonly fields?: Readonly<Record<string, string>>;
  readonly issues?: readonly string[];
}

const manualSchema = z.object({
  kwh: z.coerce.number().min(1, "Enter a value of at least 1 kWh.").max(3000, "Values above 3,000 kWh are flagged for review."),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a billing period start."),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a billing period end."),
  archetype: z.enum(["ac_evening", "ac_all_day", "workday_absent", "mixed"]).default("mixed"),
  consent: z.coerce.boolean().default(false),
});

async function bindSession(): Promise<string> {
  const session = await ensureSession();
  ensureHousehold(session.householdId);
  const store = await cookies();
  const cookie = sessionCookie(session.householdId);
  store.set(cookie.name, cookie.value, cookie.options);
  return session.householdId;
}

export async function saveManualUsage(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = manualSchema.safeParse({
    kwh: formData.get("kwh"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    archetype: formData.get("archetype") ?? "mixed",
    consent: formData.get("consent") === "on",
  });

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fields };
  }

  const householdId = await bindSession();
  const result = saveUsage(householdId, {
    periodStart: parsed.data.periodStart,
    periodEnd: parsed.data.periodEnd,
    kwh: parsed.data.kwh,
    source: "manual",
  });

  if (!result.ok) {
    return { ok: false, message: "Check the highlighted field.", fields: { kwh: result.message } };
  }

  if (parsed.data.consent) {
    recordConsent(householdId, "aggregation", true, CONSENT_POLICY_VERSION);
  }
  syncHouseholdToCohort(householdId);
  redirect("/energy?saved=manual");
}

export async function importIntervalCsv(_prev: FormState, formData: FormData): Promise<FormState> {
  // 5 imports per hour, keyed on the signed session. Checked before reading the
  // file so a rejected caller cannot force a 5 MB parse.
  const session = await ensureSession();
  const limit = rateLimit(sessionKey("import", session.householdId), 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Too many uploads. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a CSV file to import.", fields: { file: "No file selected." } };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "The file is larger than 5 MB.", fields: { file: "Maximum file size is 5 MB." } };
  }
  if (!/\.(csv|txt)$/i.test(file.name)) {
    return { ok: false, message: "Only .csv or .txt files are accepted.", fields: { file: "Wrong file type." } };
  }

  const text = await file.text();
  if (text.includes("\uFFFD")) {
    return { ok: false, message: "The file is not valid UTF-8 text.", fields: { file: "Re-save the file as UTF-8." } };
  }

  const csv = parseIntervalCsv(text);
  if (!csv.ok) {
    return {
      ok: false,
      message: "Nothing was saved. Fix the rows below and try again.",
      issues: csv.errors.slice(0, 12),
    };
  }

  const validation = validateIntervals(csv.readings);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Nothing was saved because the interval data failed validation.",
      issues: validation.issues.map((issue) => issue.message).slice(0, 12),
    };
  }

  const estimate = intervalEstimate({ readings: csv.readings });
  const householdId = await bindSession();

  const periodStart = (validation.start ?? new Date().toISOString()).slice(0, 10);
  const periodEnd = (validation.end ?? new Date().toISOString()).slice(0, 10);
  const periodEndExclusive = new Date(new Date(`${periodEnd}T00:00:00Z`).getTime() + 86_400_000)
    .toISOString()
    .slice(0, 10);

  const result = saveUsage(householdId, {
    periodStart,
    periodEnd: periodEndExclusive,
    kwh: Math.round(validation.totalKwh * 1000) / 1000,
    source: "csv",
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  saveImport({
    id: `import-${Date.now()}`,
    householdId,
    periodStart,
    periodEnd: periodEndExclusive,
    readings: csv.readings,
    coveragePct: validation.coveragePct,
    importedAt: new Date().toISOString(),
    fileName: file.name,
  });

  syncHouseholdToCohort(householdId);
  redirect(
    `/energy?saved=csv&coverage=${validation.coveragePct.toFixed(1)}&kg=${estimate.kgCo2e.toFixed(1)}`,
  );
}

export async function setConsent(granted: boolean): Promise<{ ok: boolean; message: string }> {
  const householdId = await bindSession();
  recordConsent(householdId, "aggregation", granted, CONSENT_POLICY_VERSION);
  syncHouseholdToCohort(householdId);
  return {
    ok: true,
    message: granted
      ? "Consent recorded. Your next confirmed period will enter the cohort at the next rebuild."
      : "Consent withdrawn. You will be removed from the cohort at the next rebuild, within one hour.",
  };
}
