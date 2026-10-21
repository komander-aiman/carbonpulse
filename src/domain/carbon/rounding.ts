/** Display rounding only. Never round before summation. */
export function roundKwh(value: number): number {
  return Math.round(value);
}

export function roundKg(value: number): number {
  return Math.round(value * 10) / 10;
}

export function roundTonnes(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Whole tonnes above 1,000 kg, otherwise kilograms. */
export function formatEmissions(kg: number): { value: number; unit: "kg" | "t"; text: string } {
  if (kg >= 1000) {
    const tonnes = roundTonnes(kg / 1000);
    return { value: tonnes, unit: "t", text: `${tonnes.toFixed(2)} t CO₂e` };
  }
  const rounded = roundKg(kg);
  return { value: rounded, unit: "kg", text: `${rounded.toFixed(1)} kg CO₂e` };
}

export function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}

/** Negligible timing effect threshold from the methodology PRD. */
export function isNegligibleDelta(deltaPct: number): boolean {
  return Math.abs(deltaPct) < 2;
}

export function formatDelta(deltaKg: number): string {
  const rounded = roundKg(deltaKg);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)} kg CO₂e`;
}
