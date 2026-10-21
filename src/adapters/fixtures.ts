/**
 * Recorded fixtures captured 2026-10-19. Tests and demo mode read these
 * instead of the network so no suite depends on a live source.
 */

/** data.gov.my `ghg_emissions`: one row per source per year. `net` has a null value. */
export const GHG_EMISSIONS_ROWS = [
  { date: "2023-01-01", source: "total", emissions: "361110.6", unit: "Gg CO2e" },
  { date: "2023-01-01", source: "net", emissions: null, unit: "Gg CO2e" },
  { date: "2023-01-01", source: "energy", emissions: "285678.59", unit: "Gg CO2e" },
  { date: "2023-01-01", source: "industrial_process", emissions: "23145.2", unit: "Gg CO2e" },
  { date: "2023-01-01", source: "agriculture", emissions: "18123.4", unit: "Gg CO2e" },
  { date: "2023-01-01", source: "waste", emissions: "34163.41", unit: "Gg CO2e" },
  { date: "2022-01-01", source: "total", emissions: "352884.1", unit: "Gg CO2e" },
  { date: "2022-01-01", source: "energy", emissions: "279451.0", unit: "Gg CO2e" },
] as const;

/** data.gov.my monthly electricity consumption, national, by sector. */
export const ELECTRICITY_CONSUMPTION_ROWS = [
  { date: "2026-06-01", sector: "domestic", value: "2451.3", unit: "GWh" },
  { date: "2026-06-01", sector: "industrial", value: "8912.7", unit: "GWh" },
  { date: "2026-07-01", sector: "domestic", value: "2512.9", unit: "GWh" },
  { date: "2026-07-01", sector: "industrial", value: "9043.1", unit: "GWh" },
  { date: "2026-08-01", sector: "domestic", value: "2498.4", unit: "GWh" },
  { date: "2026-08-01", sector: "industrial", value: "8988.5", unit: "GWh" },
] as const;

/** World Bank: response is a two-element array `[meta, rows]`. Rows are newest first. */
export const WORLD_BANK_RESPONSE = [
  { page: 1, pages: 1, per_page: "50", total: 4 },
  [
    { date: "2024", value: null, indicator: { id: "EN.GHG.CO2.PC.CE.AR5", value: "CO2 emissions (metric tons per capita)" } },
    { date: "2023", value: "8.039", indicator: { id: "EN.GHG.CO2.PC.CE.AR5", value: "CO2 emissions (metric tons per capita)" } },
    { date: "2022", value: "8.412", indicator: { id: "EN.GHG.CO2.PC.CE.AR5", value: "CO2 emissions (metric tons per capita)" } },
    { date: "2021", value: "8.901", indicator: { id: "EN.GHG.CO2.PC.CE.AR5", value: "CO2 emissions (metric tons per capita)" } },
  ],
] as const;

/** Open-Meteo archive: hourly arrays for the calibration window. */
export const OPEN_METEO_ARCHIVE = {
  latitude: 3.1804,
  longitude: 101.5173,
  hourly_units: { time: "iso8601", shortwave_radiation: "W/m²", temperature_2m: "°C" },
  hourly: {
    time: [
      "2025-09-01T00:00",
      "2025-09-01T01:00",
      "2025-09-01T12:00",
      "2025-09-01T13:00",
      "2025-09-01T14:00",
      "2025-09-01T20:00",
    ],
    shortwave_radiation: [0, 0, 720, 812, 640, 0],
    temperature_2m: [26.4, 25.9, 31.8, 32.6, 32.1, 28.3],
  },
} as const;

/** Energy Commission extract: manually verified, stored with its PDF reference. */
export const ENERGY_COMMISSION_EXTRACT = {
  documentTitle: "Malaysia Energy Statistics Handbook 2024",
  publicationDate: "2026-02-23",
  provisional: true,
  sourceUrl: "https://www.st.gov.my/",
  regions: [
    { region: "peninsular", year: 2024, kgPerKwh: 0.74, basis: "generation-weighted, tier 1" },
    { region: "sabah", year: 2024, kgPerKwh: 0.539, basis: "generation-weighted, tier 1" },
    { region: "sarawak", year: 2024, kgPerKwh: 0.199, basis: "generation-weighted, tier 1" },
  ],
} as const;
