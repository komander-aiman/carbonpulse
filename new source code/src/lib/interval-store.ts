import "server-only";

import type { IntervalReading } from "@/domain/carbon/types";
import { supabaseAdmin } from "@/lib/supabase";

export interface IntervalImport {
  readonly id: string;
  readonly householdId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly readings: readonly IntervalReading[];
  readonly coveragePct: number;
  readonly importedAt: string;
  readonly fileName: string;
}

interface IntervalStore {
  readonly imports: Map<string, IntervalImport[]>;
}

const globalForIntervals = globalThis as unknown as { __carbonpulseIntervals?: IntervalStore };

function store(): IntervalStore {
  if (!globalForIntervals.__carbonpulseIntervals) {
    globalForIntervals.__carbonpulseIntervals = { imports: new Map() };
  }
  return globalForIntervals.__carbonpulseIntervals;
}

export function saveImport(record: IntervalImport): void {
  const s = store();
  const existing = s.imports.get(record.householdId) ?? [];
  s.imports.set(record.householdId, [...existing, record]);
}

export function getImports(householdId: string): readonly IntervalImport[] {
  return [...(store().imports.get(householdId) ?? [])];
}

/** Interval import for the billing period that starts on or before a date. */
export function findImportForPeriod(householdId: string, periodStart: string): IntervalImport | null {
  return getImports(householdId)
    .filter((record) => record.periodStart <= periodStart)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0] ?? null;
}

export function deleteImports(householdId: string): void {
  store().imports.delete(householdId);
}

export async function saveImportPersistent(record: IntervalImport): Promise<void> {
  const db = supabaseAdmin();
  if (!db) {
    saveImport(record);
    return;
  }

  const { error: importError } = await db.from("usage_import").insert({
    id: record.id,
    household_id: record.householdId,
    file_name: record.fileName,
    row_count: record.readings.length,
    coverage_pct: record.coveragePct,
    period_start: record.periodStart,
    period_end: record.periodEnd,
    imported_at: record.importedAt,
  });
  if (importError) throw new Error(`Supabase import metadata save failed: ${importError.message}`);

  const rows = record.readings.map((reading) => ({
    household_id: record.householdId,
    interval_start: reading.start,
    kwh: reading.kwh,
    import_id: record.id,
  }));

  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await db.from("usage_interval").insert(rows.slice(offset, offset + 500));
    if (error) {
      await db.from("usage_interval").delete().eq("import_id", record.id);
      await db.from("usage_import").delete().eq("id", record.id);
      throw new Error(`Supabase interval save failed: ${error.message}`);
    }
  }

  saveImport(record);
}
