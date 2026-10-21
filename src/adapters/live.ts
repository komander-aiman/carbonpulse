/**
 * Live fetchers. Kept separate from the adapter definitions so the fixture
 * path stays synchronous and testable, and so every network call has the same
 * timeout and error behaviour.
 *
 * Rules taken from PRD 03, not guessed:
 * - data.gov.my allows 4 requests/minute, so only the scheduled/context path
 *   ever calls it, never per user interaction.
 * - Filter syntax is `<value>@<column>`; `filter=` returns HTTP 400.
 * - World Bank returns `[metadata, rows]` and needs `EN.GHG.CO2.PC.CE.AR5`.
 * - Open-Meteo is server-side only and requires attribution in the UI.
 */

const TIMEOUT_MS = 6_000;

export class LiveFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveFetchError";
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Context figures are national statistics; never send credentials.
      credentials: "omit",
      headers: {
        accept: "application/json, text/csv;q=0.9, */*;q=0.8",
        "user-agent": "CarbonPulse/0.1 (+https://carbonpulse.example; pilot data ingestion)",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new LiveFetchError(
      `Request to ${new URL(url).host} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
  if (!response.ok) {
    throw new LiveFetchError(`${new URL(url).host} returned HTTP ${response.status}`);
  }
  return response;
}

async function requestJson<T>(url: string): Promise<T> {
  return (await (await request(url)).json()) as T;
}

async function requestText(url: string): Promise<string> {
  return (await request(url)).text();
}

/* -------------------------------------------------------------------------- */
/* data.gov.my                                                                */
/* -------------------------------------------------------------------------- */

/** One call, no filter: 238 rows covers every source and year. */
export function fetchGhgLive(): Promise<readonly Record<string, unknown>[]> {
  return requestJson<readonly Record<string, unknown>[]>(
    "https://api.data.gov.my/data-catalogue?id=ghg_emissions&limit=1000",
  );
}

/**
 * Bulk CSV, not the rate-limited API. Columns are `date,sector,consumption`
 * and sectors include `local_domestic`, `local_commercial`, `losses`, `total`.
 */
export async function fetchElectricityLive(): Promise<readonly Record<string, unknown>[]> {
  const text = await requestText("https://storage.data.gov.my/energy/electricity_consumption.csv");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0];
  if (!header) throw new LiveFetchError("Electricity CSV was empty.");

  const columns = header.split(",").map((value) => value.trim());
  const dateIndex = columns.indexOf("date");
  const sectorIndex = columns.indexOf("sector");
  const valueIndex = columns.findIndex((column) => column === "consumption" || column === "value");
  if (dateIndex === -1 || sectorIndex === -1 || valueIndex === -1) {
    throw new LiveFetchError("Electricity CSV columns changed; expected date, sector, consumption.");
  }

  // Only the most recent 36 months are used anywhere in the UI.
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i]!.split(",");
    const date = cells[dateIndex]?.trim();
    const sector = cells[sectorIndex]?.trim();
    const raw = cells[valueIndex]?.trim();
    if (!date || !sector || !raw) continue;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) continue;
    rows.push({ date, sector, consumption: numeric });
  }
  if (rows.length === 0) throw new LiveFetchError("Electricity CSV had no usable rows.");
  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-36 * 6);
}

/* -------------------------------------------------------------------------- */
/* World Bank                                                                 */
/* -------------------------------------------------------------------------- */

export function fetchWorldBankLive(): Promise<readonly [unknown, readonly Record<string, unknown>[]]> {
  return requestJson<readonly [unknown, readonly Record<string, unknown>[]]>(
    "https://api.worldbank.org/v2/country/MYS/indicator/EN.GHG.CO2.PC.CE.AR5?format=json&per_page=10",
  );
}

/* -------------------------------------------------------------------------- */
/* Open-Meteo                                                                 */
/* -------------------------------------------------------------------------- */

function isoDay(offsetDays: number): string {
  const date = new Date(Date.now() - offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/**
 * Last seven days of hourly weather for Elmina. The archive lags by a few
 * days, so the window ends three days back.
 */
export function fetchOpenMeteoLive(): Promise<{
  readonly hourly?: {
    readonly time?: readonly string[];
    readonly shortwave_radiation?: readonly (number | null)[];
    readonly temperature_2m?: readonly (number | null)[];
  };
}> {
  const url =
    "https://archive-api.open-meteo.com/v1/archive" +
    "?latitude=3.1804&longitude=101.5173" +
    `&start_date=${isoDay(10)}&end_date=${isoDay(3)}` +
    "&hourly=temperature_2m,shortwave_radiation&timezone=Asia%2FKuala_Lumpur";
  return requestJson(url);
}
