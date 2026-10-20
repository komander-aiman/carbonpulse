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

/**
 * Assigns the signed household session before any page renders. Without this,
 * the first read would use the demo id and the first mutation would create a
 * different household, splitting state. The cookie carries only an opaque id;
 * no client-supplied id is ever trusted.
 */
export default async function proxy(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing && (await isValid(existing))) return NextResponse.next();

  const householdId = crypto.randomUUID();
  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, `${householdId}.${await sign(householdId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
