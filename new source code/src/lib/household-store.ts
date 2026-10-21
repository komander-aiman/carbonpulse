import "server-only";

import { DEMO_COMPLETED_ACTIONS, DEMO_HOUSEHOLD, DEMO_PERIODS } from "@/db/demo";
import type { HouseholdActionState } from "@/domain/actions";
import { DEMO_MODE } from "@/lib/config";

export interface UsageRecord {
  readonly id: string;
  readonly householdId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly kwh: number;
  readonly source: "manual" | "csv" | "derived" | "demo";
  readonly confirmedAt: string;
  readonly isDemo: boolean;
}

export interface ActionRecord {
  readonly actionId: string;
  readonly state: HouseholdActionState;
  readonly updatedAt: string;
}

export interface ConsentRecord {
  readonly scope: "aggregation" | "content";
  readonly granted: boolean;
  readonly policyVersion: string;
  readonly updatedAt: string;
}

export interface Household {
  readonly id: string;
  readonly displayName: string;
  readonly township: string;
  readonly subzone: string;
  readonly archetype: string;
  readonly isDemo: boolean;
}

export interface HouseholdData {
  readonly household: Household;
  readonly usage: readonly UsageRecord[];
  readonly actions: readonly ActionRecord[];
  readonly consents: readonly ConsentRecord[];
}

/**
 * In-memory store standing in for Postgres in the pilot scaffold. The shape
 * mirrors the schema in PRD 05 so the swap to Supabase is mechanical; every
 * read is scoped by household id, never by a client-supplied id.
 */
interface Store {
  readonly households: Map<string, Household>;
  readonly usage: Map<string, UsageRecord[]>;
  readonly actions: Map<string, ActionRecord[]>;
  readonly consents: Map<string, ConsentRecord[]>;
}

const globalForStore = globalThis as unknown as { __carbonpulseStore?: Store };

function store(): Store {
  if (!globalForStore.__carbonpulseStore) {
    globalForStore.__carbonpulseStore = {
      households: new Map(),
      usage: new Map(),
      actions: new Map(),
      consents: new Map(),
    };
  }
  return globalForStore.__carbonpulseStore;
}

function demoUsage(householdId: string): UsageRecord[] {
  return DEMO_PERIODS.map((period, index) => ({
    id: `demo-usage-${index + 1}`,
    householdId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    kwh: period.kwh,
    source: "demo" as const,
    confirmedAt: new Date(`${period.periodStart}T00:00:00Z`).toISOString(),
    isDemo: true,
  }));
}

function createHousehold(householdId: string, isDemo: boolean): HouseholdData {
  const household: Household = isDemo
    ? {
        id: householdId,
        displayName: DEMO_HOUSEHOLD.displayName,
        township: DEMO_HOUSEHOLD.township,
        subzone: DEMO_HOUSEHOLD.subzone,
        archetype: DEMO_HOUSEHOLD.archetype,
        isDemo: true,
      }
    : {
        id: householdId,
        displayName: "Your household",
        township: "elmina",
        subzone: "elmina-central",
        archetype: "mixed",
        isDemo: false,
      };

  const usage = isDemo ? demoUsage(householdId) : [];
  const actions: ActionRecord[] = isDemo
    ? DEMO_COMPLETED_ACTIONS.map((actionId) => ({
        actionId,
        state: "done" as const,
        updatedAt: new Date("2026-10-02T00:00:00Z").toISOString(),
      }))
    : [];

  const data: HouseholdData = {
    household,
    usage,
    actions,
    consents: [],
  };

  persist(data);
  return data;
}

function persist(data: HouseholdData): void {
  const s = store();
  s.households.set(data.household.id, data.household);
  s.usage.set(data.household.id, [...data.usage]);
  s.actions.set(data.household.id, [...data.actions]);
  s.consents.set(data.household.id, [...data.consents]);
  evictIfNeeded();
}

/**
 * The scaffold holds household state in process memory, so an unauthenticated
 * visitor can grow it with a fresh cookie on every request. Production uses
 * Postgres; until then, cap the map and drop the oldest households so a single
 * instance cannot be exhausted. Insertion order is used as the recency proxy
 * because every write deletes and re-sets the key.
 */
const MAX_HOUSEHOLDS = 5_000;

function evictIfNeeded(): void {
  const s = store();
  if (s.households.size <= MAX_HOUSEHOLDS) return;
  const excess = s.households.size - MAX_HOUSEHOLDS;
  const oldest = [...s.households.keys()].slice(0, excess);
  for (const id of oldest) {
    s.households.delete(id);
    s.usage.delete(id);
    s.actions.delete(id);
    s.consents.delete(id);
  }
}

export function getHousehold(householdId: string): HouseholdData | null {
  const s = store();
  const household = s.households.get(householdId);
  if (!household) return null;
  return {
    household,
    usage: [...(s.usage.get(householdId) ?? [])].sort((a, b) =>
      a.periodStart.localeCompare(b.periodStart),
    ),
    actions: [...(s.actions.get(householdId) ?? [])],
    consents: [...(s.consents.get(householdId) ?? [])],
  };
}

/**
 * First visit for a session. Demo data is seeded only when demo mode is on;
 * with `DEMO_MODE=false` a new household starts empty so the app shows its
 * real first-run state. Callers that genuinely need a seeded household (the
 * seed script) can pass `demo` explicitly.
 */
export function ensureHousehold(householdId: string, demo: boolean = DEMO_MODE): HouseholdData {
  return getHousehold(householdId) ?? createHousehold(householdId, demo);
}

export interface SaveUsageInput {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly kwh: number;
  readonly source: "manual" | "csv" | "derived";
}

export type SaveUsageResult =
  | { readonly ok: true; readonly record: UsageRecord; readonly replacedDemo: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function saveUsage(householdId: string, input: SaveUsageInput): SaveUsageResult {
  const data = ensureHousehold(householdId);
  const s = store();

  if (!Number.isFinite(input.kwh) || input.kwh <= 0 || input.kwh > 3000) {
    return { ok: false, code: "invalid_kwh", message: "Enter a usage value between 1 and 3,000 kWh." };
  }
  if (input.periodEnd <= input.periodStart) {
    return { ok: false, code: "invalid_period", message: "The billing period end must be after the start." };
  }

  const startMs = new Date(`${input.periodStart}T00:00:00Z`).getTime();
  const endMs = new Date(`${input.periodEnd}T00:00:00Z`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, code: "invalid_period", message: "Enter a valid billing period." };
  }
  if (endMs > Date.now()) {
    return {
      ok: false,
      code: "period_in_future",
      message: "The billing period cannot end in the future.",
    };
  }
  const monthsOld = (Date.now() - startMs) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOld > 24) {
    return { ok: false, code: "period_too_old", message: "Billing periods must be within the last 24 months." };
  }
  if (endMs - startMs > 400 * 86_400_000) {
    return {
      ok: false,
      code: "period_too_long",
      message: "A single billing period cannot span more than about 13 months.",
    };
  }

  if (data.usage.some((record) => record.periodStart === input.periodStart && !record.isDemo)) {
    return {
      ok: false,
      code: "duplicate_period",
      message: "A confirmed record already exists for this billing period.",
    };
  }

  // FR-1.2: periods must not overlap. Comparing only exact start dates let a
  // resident save two records for the same electricity.
  const overlap = data.usage.find(
    (record) =>
      !record.isDemo &&
      new Date(`${record.periodStart}T00:00:00Z`).getTime() < endMs &&
      new Date(`${record.periodEnd}T00:00:00Z`).getTime() > startMs,
  );
  if (overlap) {
    return {
      ok: false,
      code: "overlapping_period",
      message: `This period overlaps an existing record (${overlap.periodStart} to ${overlap.periodEnd}).`,
    };
  }

  const replacedDemo = data.usage.some((record) => record.isDemo);
  const retained = replacedDemo ? [] : data.usage;

  const record: UsageRecord = {
    id: `usage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    householdId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    kwh: input.kwh,
    source: input.source,
    confirmedAt: new Date().toISOString(),
    isDemo: false,
  };

  s.usage.set(householdId, [...retained, record].sort((a, b) => a.periodStart.localeCompare(b.periodStart)));
  s.households.set(householdId, { ...data.household, isDemo: false });
  return { ok: true, record, replacedDemo };
}

export function setActionState(householdId: string, actionId: string, state: HouseholdActionState): void {
  const data = ensureHousehold(householdId);
  const s = store();
  const others = data.actions.filter((action) => action.actionId !== actionId);
  s.actions.set(householdId, [
    ...others,
    { actionId, state, updatedAt: new Date().toISOString() },
  ]);
}

export function getConsent(householdId: string, scope: "aggregation" | "content"): ConsentRecord | null {
  const data = ensureHousehold(householdId);
  return data.consents.filter((consent) => consent.scope === scope).at(-1) ?? null;
}

export function recordConsent(
  householdId: string,
  scope: "aggregation" | "content",
  granted: boolean,
  policyVersion: string,
): ConsentRecord {
  const data = ensureHousehold(householdId);
  const s = store();
  const record: ConsentRecord = {
    scope,
    granted,
    policyVersion,
    updatedAt: new Date().toISOString(),
  };
  s.consents.set(householdId, [...data.consents, record]);
  return record;
}

export function deleteHousehold(householdId: string): void {
  const s = store();
  s.households.delete(householdId);
  s.usage.delete(householdId);
  s.actions.delete(householdId);
  s.consents.delete(householdId);
}

export function latestUsage(data: HouseholdData): UsageRecord | null {
  return data.usage.at(-1) ?? null;
}

export function trailingKwh(data: HouseholdData, count = 3): number[] {
  return data.usage.slice(-count).map((record) => record.kwh);
}

export function previousUsage(data: HouseholdData): UsageRecord | null {
  return data.usage.length >= 2 ? (data.usage.at(-2) ?? null) : null;
}
