import "server-only";

/**
 * CSRF defence for route handlers. SameSite=Lax already blocks most
 * cross-site form posts, but it does not cover same-site subdomain attacks or
 * clients that ignore cookie policy. Every mutating request must therefore
 * carry an Origin (or Referer) matching this deployment.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");
  if (!host) return false;

  const expectedHosts = new Set<string>([host]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      expectedHosts.add(new URL(configured).host);
    } catch {
      // A malformed env value should not widen the check.
    }
  }

  const candidate = origin ?? referer;
  // No Origin and no Referer: refuse. Browsers always send one on a
  // cross-origin mutation, so this only rejects non-browser clients.
  if (!candidate) return false;

  try {
    const url = new URL(candidate);
    return expectedHosts.has(url.host) && (url.protocol === "https:" || url.protocol === "http:");
  } catch {
    return false;
  }
}

/** Standard 403 body for a rejected cross-origin mutation. */
export function forbiddenOrigin(): Response {
  return new Response(
    JSON.stringify({ ok: false, error: { code: "cross_origin", message: "Request origin not allowed." } }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}
