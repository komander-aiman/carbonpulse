export type SourceStatus = "live" | "cached" | "demo";

export interface SourceResult<T> {
  readonly data: T;
  readonly status: SourceStatus;
  readonly fetchedAt: string;
  readonly sourceUpdatedAt: string | null;
  readonly sourceId: string;
  readonly checksum: string;
}

export interface ValidationIssue {
  readonly row: number;
  readonly field: string;
  readonly message: string;
}

export interface ValidationReport {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly rowCount: number;
}

export interface NormalizedRow {
  readonly [key: string]: string | number | null;
}

export interface SourceAdapter<Raw, T> {
  readonly id: string;
  fetch(): Promise<Raw>;
  normalize(raw: Raw): T;
  validate(rows: T): ValidationReport;
}

/** Stable, order-independent hash for snapshot idempotency. */
export function checksum(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + code, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

/** Never throw into a page render: fall back to the last good snapshot. */
export async function withFallback<Raw, T>(
  adapter: SourceAdapter<Raw, T>,
  fallback: T,
): Promise<SourceResult<T>> {
  const now = new Date().toISOString();
  try {
    const raw = await adapter.fetch();
    const rows = adapter.normalize(raw);
    const report = adapter.validate(rows);
    if (!report.ok) {
      return {
        data: fallback,
        status: "cached",
        fetchedAt: now,
        sourceUpdatedAt: null,
        sourceId: adapter.id,
        checksum: checksum(fallback),
      };
    }
    return {
      data: rows,
      status: "live",
      fetchedAt: now,
      sourceUpdatedAt: null,
      sourceId: adapter.id,
      checksum: checksum(rows),
    };
  } catch {
    return {
      data: fallback,
      status: "cached",
      fetchedAt: now,
      sourceUpdatedAt: null,
      sourceId: adapter.id,
      checksum: checksum(fallback),
    };
  }
}
