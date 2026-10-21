import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "carbonpulse_session";
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "carbonpulse-development-session-secret";
}

function base64url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(signature);
}

async function isValid(token: string): Promise<boolean> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const householdId = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  return provided === (await sign(householdId));
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Nonce-based CSP, built per request.
 *
 * A static CSP in `next.config.ts` cannot work here: the App Router emits
 * inline bootstrap scripts, and blocking them breaks hydration on every page.
 * Next reads the `nonce-` value from the CSP header and applies it to its own
 * scripts, so this stays strict without `unsafe-inline` for scripts.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} blob:`,
    "worker-src 'self' blob:",
    // MapLibre injects inline styles, and the design system uses inline
    // style attributes for computed widths, so styles cannot be nonced.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://tiles.openfreemap.org https://server.arcgisonline.com",
    "connect-src 'self' https://tiles.openfreemap.org https://server.arcgisonline.com https://api.open-meteo.com https://archive-api.open-meteo.com https://air-quality-api.open-meteo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Assigns the signed household session before any page renders, and applies
 * the per-request security headers. The cookie carries only an opaque id; no
 * client-supplied id is ever trusted.
 */
export default async function proxy(request: NextRequest) {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const existing = request.cookies.get(COOKIE_NAME)?.value;
  const needsSession = !(existing && (await isValid(existing)));

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (needsSession) {
    const householdId = crypto.randomUUID();
    response.cookies.set(COOKIE_NAME, `${householdId}.${await sign(householdId)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
