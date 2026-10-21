import "server-only";

/**
 * Fixed-window rate limiter for mutation endpoints (PRD 05 §6).
 *
 * Process-local, which is enough for the single-instance scaffold and a
 * deliberate limitation to state: a multi-instance deployment must move this
 * to Redis or Postgres. Keys are session or IP identifiers only, never kWh or
 * file content, so the limiter cannot become a data-leak channel.
 */

interface Window {
  count: number;
  resetAt: number;
}

const globalForLimits = globalThis as unknown as { __carbonpulseLimits?: Map<string, Window> };

function buckets(): Map<string, Window> {
  if (!globalForLimits.__carbonpulseLimits) {
    globalForLimits.__carbonpulseLimits = new Map();
  }
  return globalForLimits.__carbonpulseLimits;
}

const MAX_KEYS = 20_000;

function sweep(now: number): void {
  const map = buckets();
  for (const [key, window] of map) {
    if (window.resetAt <= now) map.delete(key);
  }
  // Hard cap so a flood of unique keys cannot itself exhaust memory.
  if (map.size > MAX_KEYS) {
    const excess = map.size - MAX_KEYS;
    let removed = 0;
    for (const key of map.keys()) {
      map.delete(key);
      removed += 1;
      if (removed >= excess) break;
    }
  }
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const map = buckets();
  if (Math.random() < 0.01) sweep(now);

  let window = map.get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + windowMs };
    map.set(key, window);
  }

  window.count += 1;
  const allowed = window.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - window.count),
    resetAt: window.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
  };
}

/** Best-effort client identity. Never logged, only used as a bucket key. */
export function clientKey(request: Request, scope: string, sessionId?: string): string {
  if (sessionId) return `${scope}:session:${sessionId}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:ip:${ip}`;
}

/** Server Action variant: the session is already resolved, so no request is needed. */
export function sessionKey(scope: string, sessionId: string): string {
  return `${scope}:session:${sessionId}`;
}

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: "rate_limited",
        message: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
      },
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(result.retryAfterSeconds),
        "x-ratelimit-remaining": "0",
      },
    },
  );
}
