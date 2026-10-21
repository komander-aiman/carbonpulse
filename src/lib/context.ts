import "server-only";

import {
  ghgAdapter,
  electricityAdapter,
  worldBankAdapter,
  openMeteoAdapter,
  runAdapter,
  domesticShareOf,
  latestObservation,
  coolingDegreeHours,
  type GhgRow,
  type ElectricityRow,
  type PerCapitaRow,
  type WeatherHour,
} from "@/adapters/sources";
import { checksum } from "@/adapters/contract";
import type { FreshnessState } from "@/lib/format";

export interface ContextFigure {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly sourceId: string;
  readonly freshness: FreshnessState;
  readonly fetchedAt: string;
  readonly status: "live" | "cached" | "demo";
}

export interface ContextBlock {
  readonly figures: readonly ContextFigure[];
  readonly runs: readonly {
    readonly sourceId: string;
    readonly status: string;
    readonly ok: boolean;
    readonly rowCount: number;
    readonly fetchedAt: string;
  }[];
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const globalForContext = globalThis as unknown as {
  __carbonpulseContext?: { at: number; demo: boolean; block: ContextBlock };
};

/**
 * Context figures are served from a short-lived server cache so a page render
 * never fans out to four sources. Adapters never throw into the render: a
 * failed source falls back to the recorded fixture and is labelled Cached.
 */
export async function loadContext(): Promise<ContextBlock> {
  const demo = process.env.DEMO_MODE !== "false";

  const cached = globalForContext.__carbonpulseContext;
  // The cache key includes demo mode: flipping the flag must not serve a block
  // built under the other mode, which would mislabel freshness.
  if (cached && cached.demo === demo && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.block;
  }

  const ghgFallback: readonly GhgRow[] = [
    { year: 2023, source: "total", emissionsGg: 361110.6 },
    { year: 2023, source: "energy", emissionsGg: 285678.59 },
  ];
  const electricityFallback: readonly ElectricityRow[] = [
    { period: "2026-06", sector: "domestic", gwh: 2451.3 },
    { period: "2026-06", sector: "industrial", gwh: 8912.7 },
    { period: "2026-07", sector: "domestic", gwh: 2512.9 },
    { period: "2026-07", sector: "industrial", gwh: 9043.1 },
    { period: "2026-08", sector: "domestic", gwh: 2498.4 },
    { period: "2026-08", sector: "industrial", gwh: 8988.5 },
  ];
  const bankFallback: readonly PerCapitaRow[] = [{ year: 2023, tonnesPerCapita: 8.039 }];
  const weatherFallback: readonly WeatherHour[] = [
    { time: "2025-09-01T12:00", radiationWm2: 720, temperatureC: 31.8 },
    { time: "2025-09-01T20:00", radiationWm2: 0, temperatureC: 28.3 },
  ];

  const [ghg, electricity, bank, weather] = await Promise.all([
    runAdapter(ghgAdapter, ghgFallback),
    runAdapter(electricityAdapter, electricityFallback),
    runAdapter(worldBankAdapter, bankFallback),
    runAdapter(openMeteoAdapter, weatherFallback),
  ]);

  const ghgTotal = [...ghg.rows].filter((row) => row.source === "total").sort((a, b) => b.year - a.year)[0];
  const ghgEnergy = [...ghg.rows].filter((row) => row.source === "energy").sort((a, b) => b.year - a.year)[0];
  const latestPeriod = [...electricity.rows].sort((a, b) => b.period.localeCompare(a.period))[0]?.period;
  const domesticShare = latestPeriod ? domesticShareOf(electricity.rows, latestPeriod) : null;
  const capita = latestObservation(bank.rows);
  const cdh = coolingDegreeHours(weather.rows);

  const figure = (
    label: string,
    value: string,
    detail: string,
    sourceId: string,
    run: { status: "live" | "cached" | "demo"; fetchedAt: string },
  ): ContextFigure => ({
    label,
    value,
    detail,
    sourceId,
    freshness: demo ? "demo" : run.status === "live" ? "live" : "cached",
    fetchedAt: run.fetchedAt,
    status: run.status,
  });

  const block: ContextBlock = {
    figures: [
      figure(
        "Malaysia CO₂e per person",
        capita ? `${capita.tonnesPerCapita.toFixed(3)} t` : "—",
        `${capita?.year ?? "—"} · World Bank EN.GHG.CO2.PC.CE.AR5`,
        "S12",
        bank.run,
      ),
      figure(
        "National GHG, all sources",
        ghgTotal ? `${ghgTotal.emissionsGg.toLocaleString("en-MY")} Gg` : "—",
        `${ghgTotal?.year ?? "—"} · energy is ${ghgEnergy ? `${ghgEnergy.emissionsGg.toLocaleString("en-MY")} Gg` : "—"}`,
        "S4",
        ghg.run,
      ),
      figure(
        "Domestic share of national electricity",
        domesticShare !== null ? `${domesticShare.toFixed(1)}%` : "—",
        `${latestPeriod ?? "—"} · national monthly consumption`,
        "S2",
        electricity.run,
      ),
      figure(
        "Cooling degree hours, Elmina",
        cdh.toFixed(1),
        "Base 24 °C · Open-Meteo hourly temperature",
        "S10",
        weather.run,
      ),
    ],
    runs: [ghg.run, electricity.run, bank.run, weather.run].map((run) => ({
      sourceId: run.sourceId,
      status: run.status,
      ok: run.ok,
      rowCount: run.rowCount,
      fetchedAt: run.fetchedAt,
    })),
  };

  globalForContext.__carbonpulseContext = { at: Date.now(), demo, block };
  return block;
}

export function contextChecksum(block: ContextBlock): string {
  return checksum(block.figures.map((figure) => [figure.sourceId, figure.value]));
}
