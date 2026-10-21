import { describe, expect, it } from "vitest";
import { parseIntervalCsv, MAX_SPAN_DAYS, MAX_ROWS } from "@/domain/carbon/interval";
import { cohortStats, eligibleRecords, type CohortRecord } from "@/domain/community";
import { getActiveFactor } from "@/domain/carbon/factors";
import { isSameOrigin } from "@/lib/csrf";
import { rateLimit, sessionKey, clientKey } from "@/lib/rate-limit";

const factor = getActiveFactor();

function csvLines(rows: string[]): string {
  return ["timestamp,kwh", ...rows].join("\n");
}

function halfHourly(startIso: string, count: number, kwh = "0.3"): string[] {
  const start = Date.parse(startIso);
  return Array.from(
    { length: count },
    (_, i) => `${new Date(start + i * 30 * 60_000).toISOString()},${kwh}`,
  );
}

describe("CSV errors reach the caller", () => {
  it("surfaces a per-row unit error instead of silently returning ok:false", () => {
    const result = parseIntervalCsv(
      csvLines([
        "2026-09-01T00:00:00+08:00,0.3",
        "2026-09-01T00:30:00+08:00,900",
        "2026-09-01T01:00:00+08:00,0.31",
      ]),
    );
    expect(result.ok).toBe(false);
    // Regression: this used to be empty, leaving the UI with no explanation.
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join(" ")).toMatch(/Wh reported as kWh/i);
  });

  it("surfaces a duplicate timestamp", () => {
    const result = parseIntervalCsv(
      csvLines([
        "2026-09-01T00:00:00+08:00,0.3",
        "2026-09-01T00:00:00+08:00,0.4",
      ]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/duplicate/i);
  });

  it("rejects a file spanning more than 90 days", () => {
    const rows = halfHourly("2026-01-01T00:00:00Z", 100 * 48);
    const result = parseIntervalCsv(csvLines(rows));
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(new RegExp(`${MAX_SPAN_DAYS} days`));
  });

  it("accepts a file just inside the span limit", () => {
    const rows = halfHourly("2026-01-01T00:00:00Z", 80 * 48);
    const result = parseIntervalCsv(csvLines(rows));
    expect(result.errors.join(" ")).not.toMatch(/days/);
  });

  it("caps the row count", () => {
    const rows = halfHourly("2026-01-01T00:00:00Z", MAX_ROWS + 10);
    const result = parseIntervalCsv(csvLines(rows));
    expect(result.readings.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(result.ok).toBe(false);
  });
});

describe("cohort includes the viewer", () => {
  const rows = (n: number): CohortRecord[] =>
    Array.from({ length: n }, (_, i) => ({
      householdId: `h-${i}`,
      kwh: 300 + i,
      consented: true,
      isDemo: false,
      confirmed: true,
      township: "elmina",
      subzone: "elmina-central",
    }));

  it("publishes at exactly k when all k households consent", () => {
    expect(eligibleRecords(rows(5)).length).toBe(5);
    expect(cohortStats(rows(5), factor).suppressed).toBe(false);
  });

  it("still suppresses at k-1", () => {
    expect(cohortStats(rows(4), factor).suppressed).toBe(true);
  });
});

describe("CSRF origin check", () => {
  function request(headers: Record<string, string>): Request {
    return new Request("https://app.example/api/usage", { headers });
  }

  it("accepts a matching origin", () => {
    expect(isSameOrigin(request({ host: "app.example", origin: "https://app.example" }))).toBe(true);
  });

  it("rejects a foreign origin", () => {
    expect(isSameOrigin(request({ host: "app.example", origin: "https://evil.example" }))).toBe(false);
  });

  it("rejects a same-site subdomain that is not the host", () => {
    expect(isSameOrigin(request({ host: "app.example", origin: "https://evil.app.example" }))).toBe(false);
  });

  it("rejects a request with no origin and no referer", () => {
    expect(isSameOrigin(request({ host: "app.example" }))).toBe(false);
  });

  it("falls back to referer when origin is absent", () => {
    expect(
      isSameOrigin(request({ host: "app.example", referer: "https://app.example/energy" })),
    ).toBe(true);
  });

  it("rejects a protocol-relative or unparseable origin", () => {
    expect(isSameOrigin(request({ host: "app.example", origin: "//evil.example" }))).toBe(false);
    expect(isSameOrigin(request({ host: "app.example", origin: "not a url" }))).toBe(false);
  });

  it("rejects when the host header is missing", () => {
    expect(isSameOrigin(request({ origin: "https://app.example" }))).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = sessionKey("test-limit", `run-${Date.now()}-${Math.random()}`);
    for (let i = 0; i < 3; i += 1) {
      expect(rateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate buckets per scope", () => {
    const id = `s-${Math.random()}`;
    expect(rateLimit(sessionKey("a", id), 1, 60_000).allowed).toBe(true);
    expect(rateLimit(sessionKey("b", id), 1, 60_000).allowed).toBe(true);
  });

  it("uses the session id ahead of the IP", () => {
    const req = new Request("https://app.example", { headers: { "x-forwarded-for": "1.2.3.4" } });
    expect(clientKey(req, "usage", "sess-1")).toBe("usage:session:sess-1");
    expect(clientKey(req, "usage")).toBe("usage:ip:1.2.3.4");
  });
});
