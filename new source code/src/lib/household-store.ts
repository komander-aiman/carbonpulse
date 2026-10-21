import "server-only";

import { randomUUID } from "node:crypto";
import { DEMO_COMPLETED_ACTIONS, DEMO_HOUSEHOLD, DEMO_PERIODS } from "@/db/demo";
import type { HouseholdActionState } from "@/domain/actions";
import { DEMO_MODE } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

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
    id: randomUUID(),
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

interface HouseholdRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly township_id: string;
  readonly subzone_id: string | null;
  readonly archetype: string;
  readonly is_demo: boolean;
}

interface UsageRow {
  readonly id: string;
  readonly household_id: string;
  readonly period_start: string;
  readonly period_end: string;
  readonly kwh: number | string;
  readonly source: "manual" | "csv" | "derived";
  readonly confirmed_at: string;
  readonly is_demo: boolean;
}

interface ActionRow {
  readonly action_id: string;
  readonly state: HouseholdActionState;
  readonly updated_at: string;
}

interface ConsentRow {
  readonly scope: "aggregation" | "content";
  readonly action: "granted" | "withdrawn";
  readonly policy_version: string;
  readonly created_at: string;
}

function databaseError(operation: string, message: string): Error {
  return new Error(`Supabase ${operation} failed: ${message}`);
}

async function referenceSlug(table: "township" | "subzone", id: string | null): Promise<string> {
  if (!id) return "elmina-central";
  const db = supabaseAdmin();
  if (!db) return table === "township" ? "elmina" : "elmina-central";
  const { data, error } = await db.from(table).select("slug").eq("id", id).single();
  if (error) throw databaseError(`reading ${table}`, error.message);
  return String(data.slug);
}

async function createDatabaseHousehold(householdId: string, demo: boolean): Promise<void> {
  const db = supabaseAdmin();
  if (!db) return;

  const { data: township, error: townshipError } = await db
    .from("township")
    .select("id")
    .eq("slug", "elmina")
    .single();
  if (townshipError) throw databaseError("finding the Elmina township", townshipError.message);

  const { data: subzone, error: subzoneError } = await db
    .from("subzone")
    .select("id")
    .eq("township_id", township.id)
    .eq("slug", demo ? "elmina-north" : "elmina-central")
    .single();
  if (subzoneError) throw databaseError("finding the default subzone", subzoneError.message);

  const { error } = await db.from("household").insert({
    id: householdId,
    display_name: demo ? DEMO_HOUSEHOLD.displayName : "Your household",
    township_id: township.id,
    subzone_id: subzone.id,
    archetype: demo ? DEMO_HOUSEHOLD.archetype : "mixed",
    is_demo: demo,
  });
  if (error && error.code !== "23505") throw databaseError("creating a household", error.message);
}

/** Load one signed-cookie household from Postgres, or use the in-memory demo. */
export async function loadHousehold(
  householdId: string,
  demo: boolean = DEMO_MODE,
): Promise<HouseholdData> {
  const db = supabaseAdmin();
  if (!db) return ensureHousehold(householdId, demo);

  let response = await db
    .from("household")
    .select("id,display_name,township_id,subzone_id,archetype,is_demo")
    .eq("id", householdId)
    .maybeSingle();
  if (response.error) throw databaseError("reading a household", response.error.message);

  if (!response.data) {
    await createDatabaseHousehold(householdId, demo);
    response = await db
      .from("household")
      .select("id,display_name,township_id,subzone_id,archetype,is_demo")
      .eq("id", householdId)
      .single();
    if (response.error) throw databaseError("reading the new household", response.error.message);
  }

  const row = response.data as HouseholdRow;
  const [township, subzone, usageResponse, actionResponse, consentResponse] = await Promise.all([
    referenceSlug("township", row.township_id),
    referenceSlug("subzone", row.subzone_id),
    db
      .from("usage_month")
      .select("id,household_id,period_start,period_end,kwh,source,confirmed_at,is_demo")
      .eq("household_id", householdId)
      .order("period_start"),
    db
      .from("household_action")
      .select("action_id,state,updated_at")
      .eq("household_id", householdId),
    db
      .from("consent_event")
      .select("scope,action,policy_version,created_at")
      .eq("household_id", householdId)
      .order("created_at"),
  ]);

  if (usageResponse.error) throw databaseError("reading usage", usageResponse.error.message);
  if (actionResponse.error) throw databaseError("reading actions", actionResponse.error.message);
  if (consentResponse.error) throw databaseError("reading consent", consentResponse.error.message);

  const data: HouseholdData = {
    household: {
      id: row.id,
      displayName: row.display_name ?? "Your household",
      township,
      subzone,
      archetype: row.archetype,
      isDemo: row.is_demo,
    },
    usage: (usageResponse.data as UsageRow[]).map((usage) => ({
      id: usage.id,
      householdId: usage.household_id,
      periodStart: usage.period_start,
      periodEnd: usage.period_end,
      kwh: Number(usage.kwh),
      source: usage.source,
      confirmedAt: usage.confirmed_at,
      isDemo: usage.is_demo,
    })),
    actions: (actionResponse.data as ActionRow[]).map((action) => ({
      actionId: action.action_id,
      state: action.state,
      updatedAt: action.updated_at,
    })),
    consents: (consentResponse.data as ConsentRow[]).map((consent) => ({
      scope: consent.scope,
      granted: consent.action === "granted",
      policyVersion: consent.policy_version,
      updatedAt: consent.created_at,
    })),
  };

  persist(data);
  return data;
}

export async function saveUsagePersistent(
  householdId: string,
  input: SaveUsageInput,
): Promise<SaveUsageResult> {
  const before = await loadHousehold(householdId, false);
  const result = saveUsage(householdId, input);
  if (!result.ok) return result;

  const db = supabaseAdmin();
  if (!db) return result;
  const { record } = result;
  const { error } = await db.from("usage_month").insert({
    id: record.id,
    household_id: householdId,
    period_start: record.periodStart,
    period_end: record.periodEnd,
    kwh: record.kwh,
    source: record.source,
    confirmed_at: record.confirmedAt,
    is_demo: false,
  });
  if (error) {
    persist(before);
    throw databaseError("saving usage", error.message);
  }
  const { error: householdError } = await db
    .from("household")
    .update({ is_demo: false })
    .eq("id", householdId);
  if (householdError) throw databaseError("updating the household", householdError.message);
  return result;
}

export async function setActionStatePersistent(
  householdId: string,
  actionId: string,
  state: HouseholdActionState,
): Promise<void> {
  await loadHousehold(householdId, false);
  const db = supabaseAdmin();
  if (db) {
    const { error } = await db.from("household_action").upsert(
      {
        household_id: householdId,
        action_id: actionId,
        evidence_version: "actions-1.0.0",
        state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,action_id" },
    );
    if (error) throw databaseError("saving an action", error.message);
  }
  setActionState(householdId, actionId, state);
}

export async function recordConsentPersistent(
  householdId: string,
  scope: "aggregation" | "content",
  granted: boolean,
  policyVersion: string,
): Promise<ConsentRecord> {
  await loadHousehold(householdId, false);
  const now = new Date().toISOString();
  const db = supabaseAdmin();
  if (db) {
    const { error } = await db.from("consent_event").insert({
      household_id: householdId,
      scope,
      action: granted ? "granted" : "withdrawn",
      policy_version: policyVersion,
      created_at: now,
    });
    if (error) throw databaseError("saving consent", error.message);
  }
  return recordConsent(householdId, scope, granted, policyVersion);
}

export async function updateHouseholdArchetypePersistent(
  householdId: string,
  archetype: "ac_evening" | "ac_all_day" | "workday_absent" | "mixed",
): Promise<void> {
  const data = await loadHousehold(householdId, false);
  const db = supabaseAdmin();
  if (db) {
    const { error } = await db.from("household").update({ archetype }).eq("id", householdId);
    if (error) throw databaseError("saving the household profile", error.message);
  }
  persist({ ...data, household: { ...data.household, archetype } });
}
