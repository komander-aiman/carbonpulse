/**
 * Shared climate types and constants. Kept free of `server-only` so client
 * components can import them without pulling in the fetcher.
 */

export interface PrecinctAtmosphere {
  readonly co2Ppm: number;
  readonly aqi: number;
  readonly coMg: number;
  readonly pm25Ugm3: number;
}

export interface Precinct {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly lat: number;
  readonly lon: number;
  /** Illustrative monthly baseline for this precinct, kWh per home. */
  readonly baselineKwh: number;
  readonly atmosphere: PrecinctAtmosphere;
  readonly live: boolean;
}

export interface ClimateSnapshot {
  readonly precincts: readonly Precinct[];
  readonly globalCo2Ppm: number;
  readonly globalLive: boolean;
  readonly weather: {
    readonly temperatureC: number;
    readonly humidity: number;
    readonly time: string | null;
    readonly live: boolean;
  };
  readonly liveCount: number;
  readonly fetchedAt: string;
}

export const PREINDUSTRIAL_CO2_PPM = 278;

export const MALAYSIA_BOUNDS: readonly [number, number][] = [
  [0.65, 99.0],
  [7.85, 119.8],
];
