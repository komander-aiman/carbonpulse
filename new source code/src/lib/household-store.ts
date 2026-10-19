import "server-only";

import { DEMO_COMPLETED_ACTIONS, DEMO_HOUSEHOLD, DEMO_PERIODS } from "@/db/demo";
import type { HouseholdActionState } from "@/domain/actions";

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

/** First visit for a session: seed the demo household so every route renders. */
export function ensureHousehold(householdId: string, demo = true): HouseholdData {
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
  const monthsOld =
    (Date.now() - new Date(`${input.periodStart}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOld > 24) {
    return { ok: false, code: "period_too_old", message: "Billing periods must be within the last 24 months." };
  }

  const existing = data.usage.filter((record) => record.periodStart === input.periodStart && !record.isDemo);
  if (existing.length > 0) {
    return {
      ok: false,
      code: "duplicate_period",
      message: "A confirmed record already exists for this billing period.",
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
