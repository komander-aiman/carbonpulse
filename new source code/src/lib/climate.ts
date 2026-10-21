import "server-only";

import type { ClimateSnapshot, Precinct, PrecinctAtmosphere } from "@/domain/climate/types";

/**
 * Township climate and air-quality context.
 *
 * Every value here is a *regional model estimate*, not a township sensor
 * reading, and the UI must say so. Fetches happen server-side:
 * - the browser never calls a third-party API directly,
 * - the CSP does not need to widen `connect-src`,
 * - results are cached so a page render cannot fan out per visitor.
 */

const AIR_FIELDS = ["carbon_dioxide", "us_aqi", "carbon_monoxide", "pm2_5"] as const;
const TIMEOUT_MS = 7_000;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Five precincts used by the pilot. Coordinates are township centroids. */
export const PRECINCT_SEEDS = [
  {
    id: "elmina-west",
    name: "Elmina West",
    subtitle: "Pilot precinct",
    lat: 3.189,
    lon: 101.509,
    baselineKwh: 345,
    fallback: { co2Ppm: 428.2, aqi: 42, coMg: 186, pm25Ugm3: 11.8 },
  },
  {
    id: "elmina-east",
    name: "Elmina East",
    subtitle: "Residential precinct",
    lat: 3.195,
    lon: 101.528,
    baselineKwh: 330,
    fallback: { co2Ppm: 429.1, aqi: 48, coMg: 205, pm25Ugm3: 13.4 },
  },
  {
    id: "elmina-business",
    name: "Elmina Business Park",
    subtitle: "Commercial context",
    lat: 3.22,
    lon: 101.515,
    baselineKwh: 365,
    fallback: { co2Ppm: 431.5, aqi: 61, coMg: 244, pm25Ugm3: 18.7 },
  },
  {
    id: "bukit-raja",
    name: "Bandar Bukit Raja",
    subtitle: "Township context",
    lat: 3.076,
    lon: 101.448,
    baselineKwh: 315,
    fallback: { co2Ppm: 426.8, aqi: 39, coMg: 172, pm25Ugm3: 10.2 },
  },
  {
    id: "serenia-city",
    name: "Serenia City",
    subtitle: "Township context",
    lat: 2.842,
    lon: 101.703,
    baselineKwh: 295,
    fallback: { co2Ppm: 427.6, aqi: 45, coMg: 193, pm25Ugm3: 12.1 },
  },
] as const;

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": "CarbonPulse/0.1 (pilot)" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface AirQualityResponse {
  readonly current?: Record<string, unknown>;
}

interface ForecastResponse {
  readonly current?: Record<string, unknown>;
}

interface GlobalCo2Response {
  readonly co2?: readonly { readonly trend?: string; readonly cycle?: string }[];
}

/** Latest non-null trend value from the Global Warming API. */
export function latestGlobalCo2(payload: GlobalCo2Response | null): number | null {
  const rows = payload?.co2;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const trend = Number(row?.trend);
    if (Number.isFinite(trend) && trend > 300 && trend < 600) return trend;
    const cycle = Number(row?.cycle);
    if (Number.isFinite(cycle) && cycle > 300 && cycle < 600) return cycle;
  }
  return null;
}

function readAtmosphere(current: Record<string, unknown> | undefined, fallback: PrecinctAtmosphere) {
  if (!current) return { atmosphere: fallback, live: false };
  const complete = AIR_FIELDS.every((field) => Number.isFinite(Number(current[field])));
  return {
    atmosphere: {
      co2Ppm: num(current.carbon_dioxide, fallback.co2Ppm),
      aqi: num(current.us_aqi, fallback.aqi),
      coMg: num(current.carbon_monoxide, fallback.coMg),
      pm25Ugm3: num(current.pm_2_5 ?? current.pm2_5, fallback.pm25Ugm3),
    },
    live: complete,
  };
}

const globalForClimate = globalThis as unknown as {
  __carbonpulseClimate?: { at: number; snapshot: ClimateSnapshot };
  __carbonpulseAirCache?: Map<string, { at: number; atmosphere: PrecinctAtmosphere; live: boolean }>;
};

function airCache(): Map<string, { at: number; atmosphere: PrecinctAtmosphere; live: boolean }> {
  if (!globalForClimate.__carbonpulseAirCache) globalForClimate.__carbonpulseAirCache = new Map();
  return globalForClimate.__carbonpulseAirCache;
}

/**
 * Builds a climate snapshot. With `allowNetwork` false (demo mode) the
 * recorded fallbacks are returned and every value is labelled as fallback.
 */
export async function loadClimate(allowNetwork: boolean): Promise<ClimateSnapshot> {
  const cached = globalForClimate.__carbonpulseClimate;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.snapshot;

  const cache = airCache();
  const now = Date.now();

  const airResults = await Promise.all(
    PRECINCT_SEEDS.map(async (seed) => {
      const hit = cache.get(seed.id);
      if (hit && now - hit.at < CACHE_TTL_MS) return hit;
      if (!allowNetwork) {
        const fallback = { at: now, atmosphere: { ...seed.fallback }, live: false };
        cache.set(seed.id, fallback);
        return fallback;
      }
      const url =
        "https://air-quality-api.open-meteo.com/v1/air-quality" +
        `?latitude=${seed.lat}&longitude=${seed.lon}` +
        "&current=us_aqi,pm2_5,carbon_monoxide,carbon_dioxide&timezone=Asia%2FKuala_Lumpur";
      const payload = await getJson<AirQualityResponse>(url);
      const resolved = readAtmosphere(payload?.current, { ...seed.fallback });
      const entry = { at: now, atmosphere: resolved.atmosphere, live: resolved.live };
      cache.set(seed.id, entry);
      return entry;
    }),
  );

  const weatherPromise = allowNetwork
    ? getJson<ForecastResponse>(
        "https://api.open-meteo.com/v1/forecast?latitude=3.1890&longitude=101.5090" +
          "&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FKuala_Lumpur",
      )
    : Promise.resolve(null);

  const globalPromise = allowNetwork
    ? getJson<GlobalCo2Response>("https://global-warming.org/api/co2-api")
    : Promise.resolve(null);

  const [weatherPayload, globalPayload] = await Promise.all([weatherPromise, globalPromise]);

  const precincts: Precinct[] = PRECINCT_SEEDS.map((seed, index) => ({
    id: seed.id,
    name: seed.name,
    subtitle: seed.subtitle,
    lat: seed.lat,
    lon: seed.lon,
    baselineKwh: seed.baselineKwh,
    atmosphere: airResults[index]!.atmosphere,
    live: airResults[index]!.live,
  }));

  const current = weatherPayload?.current;
  const weatherLive =
    Number.isFinite(Number(current?.temperature_2m)) && Number.isFinite(Number(current?.relative_humidity_2m));
  const globalCo2 = latestGlobalCo2(globalPayload);

  const snapshot: ClimateSnapshot = {
    precincts,
    globalCo2Ppm: globalCo2 ?? 427.4,
    globalLive: globalCo2 !== null,
    weather: {
      temperatureC: num(current?.temperature_2m, 31.2),
      humidity: num(current?.relative_humidity_2m, 72),
      time: typeof current?.time === "string" ? current.time : null,
      live: weatherLive,
    },
    liveCount: precincts.filter((precinct) => precinct.live).length,
    fetchedAt: new Date().toISOString(),
  };

  globalForClimate.__carbonpulseClimate = { at: now, snapshot };
  return snapshot;
}
