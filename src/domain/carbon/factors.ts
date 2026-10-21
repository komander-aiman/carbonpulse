import type { FactorVersion } from "./types";

/**
 * Immutable factor registry. Order is newest first per region. Values are
 * published figures; corrections must add a new version rather than edit one.
 */
export const FACTOR_VERSIONS: readonly FactorVersion[] = [
  {
    id: "peninsular-2024-provisional",
    region: "peninsular",
    year: 2024,
    kgPerKwh: 0.74,
    status: "provisional",
    basis:
      "Generation-weighted average, main activity producers, Tier 1 factors, net generation",
    sourceId: "S1",
    sourceUrl: "https://www.st.gov.my/",
    publishedOn: "2026-02-23",
    supersedesId: "peninsular-2023-provisional",
  },
  {
    id: "peninsular-2023-provisional",
    region: "peninsular",
    year: 2023,
    kgPerKwh: 0.76,
    status: "provisional",
    basis: "Generation-weighted average, main activity producers",
    sourceId: "S1",
    sourceUrl: "https://www.st.gov.my/",
    publishedOn: "2025-02-01",
    supersedesId: "peninsular-2022-provisional",
  },
  {
    id: "peninsular-2022-provisional",
    region: "peninsular",
    year: 2022,
    kgPerKwh: 0.769,
    status: "provisional",
    basis: "Generation-weighted average, main activity producers",
    sourceId: "S1",
    sourceUrl: "https://www.st.gov.my/",
    publishedOn: "2024-02-01",
    supersedesId: null,
  },
  {
    id: "sabah-2024-provisional",
    region: "sabah",
    year: 2024,
    kgPerKwh: 0.539,
    status: "provisional",
    basis: "Generation-weighted average, main activity producers",
    sourceId: "S1",
    sourceUrl: "https://www.st.gov.my/",
    publishedOn: "2026-02-23",
    supersedesId: null,
  },
  {
    id: "sarawak-2024-provisional",
    region: "sarawak",
    year: 2024,
    kgPerKwh: 0.199,
    status: "provisional",
    basis: "Generation-weighted average, main activity producers",
    sourceId: "S1",
    sourceUrl: "https://www.st.gov.my/",
    publishedOn: "2026-02-23",
    supersedesId: null,
  },
];

export function getActiveFactor(region: "peninsular" | "sabah" | "sarawak" = "peninsular"): FactorVersion {
  const latest = FACTOR_VERSIONS.filter((version) => version.region === region).sort(
    (a, b) => b.year - a.year,
  )[0];
  if (!latest) throw new Error(`No factor version registered for region ${region}`);
  return latest;
}

export function getFactorById(id: string): FactorVersion {
  const found = FACTOR_VERSIONS.find((version) => version.id === id);
  if (!found) throw new Error(`Unknown factor version ${id}`);
  return found;
}
