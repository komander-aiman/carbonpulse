import "server-only";

import type { IntervalReading } from "@/domain/carbon/types";

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
