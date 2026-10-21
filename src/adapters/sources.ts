import {
  checksum,
  type SourceAdapter,
  type ValidationReport,
  type SourceStatus,
} from "./contract";
import {
  ELECTRICITY_CONSUMPTION_ROWS,
  GHG_EMISSIONS_ROWS,
  WORLD_BANK_RESPONSE,
  OPEN_METEO_ARCHIVE,
} from "./fixtures";
import {
  fetchElectricityLive,
  fetchGhgLive,
  fetchOpenMeteoLive,
  fetchWorldBankLive,
} from "./live";

/**
 * Demo mode returns fixtures without touching the network. With it off, the
 * adapters fetch the real source; if that fails or fails validation, the
 * caller falls back to the recorded fixture and the badge reads Cached.
 */
function demoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}


/* -------------------------------------------------------------------------- */
/* data.gov.my                                                                */
/* -------------------------------------------------------------------------- */

export interface GhgRow {
  readonly year: number;
  readonly source: string;
  readonly emissionsGg: number;
}

/**
 * `ghg_emissions` returns one row per source per year and `net` carries a null
 * value. Filtering on `source` is mandatory: summing every row double-counts,
 * and including `net` produces nulls.
 */
export const ghgAdapter: SourceAdapter<readonly Record<string, unknown>[], readonly GhgRow[]> = {
  id: "S4",
  async fetch() {
    if (demoMode()) return GHG_EMISSIONS_ROWS as unknown as readonly Record<string, unknown>[];
    return fetchGhgLive();
  },
  normalize(raw) {
    return raw
      .filter((row) => row.source !== "net" && row.emissions !== null && row.emissions !== undefined && row.emissions !== "")
      .map((row) => ({
        year: Number(String(row.date ?? "").slice(0, 4)),
        source: String(row.source ?? ""),
        emissionsGg: Number(row.emissions),
      }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.emissionsGg));
  },
  validate(rows) {
    const issues = rows
      .map((row, index) =>
        row.source === "total" && row.emissionsGg <= 0
          ? { row: index, field: "emissions", message: "Total emissions must be positive." }
          : null,
      )
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    return { ok: issues.length === 0 && rows.length > 0, issues, rowCount: rows.length };
  },
};

export interface ElectricityRow {
  readonly period: string;
  readonly sector: string;
  readonly gwh: number;
}

export const electricityAdapter: SourceAdapter<
  readonly Record<string, unknown>[],
  readonly ElectricityRow[]
> = {
  id: "S2",
  async fetch() {
    if (demoMode()) return ELECTRICITY_CONSUMPTION_ROWS as unknown as readonly Record<string, unknown>[];
    return fetchElectricityLive();
  },
  normalize(raw) {
    return raw.map((row) => ({
      period: String(row.date ?? "").slice(0, 7),
      // The live CSV reports `local_domestic`; the fixture uses `domestic`.
      // Normalizing both here keeps the comparison meaningful.
      sector: String(row.sector ?? "").replace(/^local_/, ""),
      gwh: Number(row.consumption ?? row.value),
    }));
  },
  validate(rows) {
    const issues = rows
      .map((row, index) =>
        !Number.isFinite(row.gwh) || row.gwh <= 0
          ? { row: index, field: "gwh", message: "Consumption must be positive." }
          : null,
      )
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    return { ok: issues.length === 0 && rows.length > 0, issues, rowCount: rows.length };
  },
};

export function domesticShareOf(rows: readonly ElectricityRow[], period: string): number | null {
  const inPeriod = rows.filter((row) => row.period === period);
  const total = inPeriod.reduce((sum, row) => sum + row.gwh, 0);
  const domestic = inPeriod.filter((row) => row.sector === "domestic").reduce((sum, row) => sum + row.gwh, 0);
  return total === 0 ? null : (domestic / total) * 100;
}

/* -------------------------------------------------------------------------- */
/* World Bank                                                                 */
/* -------------------------------------------------------------------------- */

export interface PerCapitaRow {
  readonly year: number;
  readonly tonnesPerCapita: number;
}

type WorldBankPayload = readonly [unknown, readonly Record<string, unknown>[]];

/** Legacy `EN.ATM.CO2E.PC` is retired; `EN.GHG.CO2.PC.CE.AR5` is the live indicator. */
export const worldBankAdapter: SourceAdapter<WorldBankPayload, readonly PerCapitaRow[]> = {
  id: "S12",
  async fetch() {
    if (demoMode()) return WORLD_BANK_RESPONSE as unknown as WorldBankPayload;
    return fetchWorldBankLive();
  },
  normalize(raw) {
    const [, rows] = raw;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => row.value !== null && row.value !== undefined && row.value !== "")
      .map((row) => ({
        year: Number(row.date),
        tonnesPerCapita: Number(row.value),
      }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.tonnesPerCapita) && row.tonnesPerCapita > 0);
  },
  validate(rows) {
    const issues = rows
      .map((row, index) =>
        row.tonnesPerCapita <= 0 || row.tonnesPerCapita > 100
          ? { row: index, field: "tonnesPerCapita", message: "Implausible per-capita value." }
          : null,
      )
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    return { ok: issues.length === 0 && rows.length > 0, issues, rowCount: rows.length };
  },
};

/** Null values are dropped, so the latest observation is the newest non-null year. */
export function latestObservation(rows: readonly PerCapitaRow[]): PerCapitaRow | null {
  return [...rows].sort((a, b) => b.year - a.year)[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Open-Meteo                                                                 */
/* -------------------------------------------------------------------------- */

export interface WeatherHour {
  readonly time: string;
  readonly radiationWm2: number;
  readonly temperatureC: number;
}

interface ArchivePayload {
  readonly hourly?: {
    readonly time?: readonly string[];
    readonly shortwave_radiation?: readonly (number | null)[];
    readonly temperature_2m?: readonly (number | null)[];
  };
}

export const openMeteoAdapter: SourceAdapter<ArchivePayload, readonly WeatherHour[]> = {
  id: "S10",
  async fetch() {
    if (demoMode()) return OPEN_METEO_ARCHIVE as unknown as ArchivePayload;
    return fetchOpenMeteoLive();
  },
  normalize(raw) {
    const times = raw.hourly?.time ?? [];
    return times.map((time, index) => ({
      time,
      radiationWm2: raw.hourly?.shortwave_radiation?.[index] ?? 0,
      temperatureC: raw.hourly?.temperature_2m?.[index] ?? 0,
    }));
  },
  validate(rows) {
    const issues = rows
      .map((row, index) =>
        row.radiationWm2 < 0 || row.temperatureC < -10 || row.temperatureC > 50
          ? { row: index, field: "weather", message: "Value outside plausible bounds." }
          : null,
      )
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    return { ok: issues.length === 0 && rows.length > 0, issues, rowCount: rows.length };
  },
};

/** Cooling degree hours against a fixed 24 °C base, never agronomic degree days. */
export function coolingDegreeHours(rows: readonly WeatherHour[], baseC = 24): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.temperatureC - baseC), 0);
}

/** Mean hourly radiation profile in local clock hours (UTC+8). */
export function radiationByLocalHour(rows: readonly WeatherHour[]): number[] {
  const totals = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);
  for (const row of rows) {
    const hour = Number(row.time.slice(11, 13));
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
    totals[hour] = (totals[hour] ?? 0) + row.radiationWm2;
    counts[hour] = (counts[hour] ?? 0) + 1;
  }
  return totals.map((total, hour) => (counts[hour] ? total / counts[hour]! : 0));
}

/* -------------------------------------------------------------------------- */
/* Orchestration                                                             */
/* -------------------------------------------------------------------------- */

export interface AdapterRun {
  readonly sourceId: string;
  readonly status: SourceStatus;
  readonly checksum: string;
  readonly fetchedAt: string;
  readonly rowCount: number;
  readonly ok: boolean;
}

export async function runAdapter<Raw, T>(
  adapter: SourceAdapter<Raw, T>,
  fallback: T,
): Promise<{ rows: T; run: AdapterRun }> {
  const fetchedAt = new Date().toISOString();
  try {
    const raw = await adapter.fetch();
    const rows = adapter.normalize(raw);
    const report: ValidationReport = adapter.validate(rows);
    if (report.ok) {
      return {
        rows,
        run: {
          sourceId: adapter.id,
          // In demo mode the rows came from the recorded fixture, so reporting
          // "live" would mislabel seeded data as a live read.
          status: demoMode() ? "demo" : "live",
          checksum: checksum(rows),
          fetchedAt,
          rowCount: Array.isArray(rows) ? rows.length : 0,
          ok: true,
        },
      };
    }
    return {
      rows: fallback,
      run: {
        sourceId: adapter.id,
        status: "cached",
        checksum: checksum(fallback),
        fetchedAt,
        rowCount: Array.isArray(fallback) ? fallback.length : 0,
        ok: false,
      },
    };
  } catch {
    return {
      rows: fallback,
      run: {
        sourceId: adapter.id,
        status: "cached",
        checksum: checksum(fallback),
        fetchedAt,
        rowCount: Array.isArray(fallback) ? fallback.length : 0,
        ok: false,
      },
    };
  }
}
