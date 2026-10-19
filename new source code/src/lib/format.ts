const numberFormatter = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatKwh(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatKg(value: number): string {
  return decimalFormatter.format(Math.round(value * 10) / 10);
}

export function formatTonnes(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

const dateFormatter = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kuala_Lumpur",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kuala_Lumpur",
});

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function formatShortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : shortDateFormatter.format(date);
}

export function formatMonthLabel(periodStart: string): string {
  const date = new Date(`${periodStart}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthShort(periodStart: string): string {
  const date = new Date(`${periodStart}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: "UTC" }).format(date);
}

export function relativeDays(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export type FreshnessState = "live" | "cached" | "stale" | "demo";

export function freshnessOf(iso: string | null, isDemo: boolean): FreshnessState {
  if (isDemo) return "demo";
  const days = relativeDays(iso);
  if (days === null) return "stale";
  if (days <= 2) return "live";
  if (days <= 45) return "cached";
  return "stale";
}

export function freshnessLabel(state: FreshnessState): string {
  switch (state) {
    case "live":
      return "Live";
    case "cached":
      return "Cached";
    case "stale":
      return "Stale";
    default:
      return "Demo";
  }
}
