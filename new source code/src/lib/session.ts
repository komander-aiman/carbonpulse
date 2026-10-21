import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

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

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export interface Session {
  readonly householdId: string;
}

/** Signed cookie payload: `<uuid>.<hmac>`. The server never trusts a raw id. */
function encode(householdId: string): string {
  return `${householdId}.${sign(householdId)}`;
}

function decode(token: string): Session | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const householdId = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  const expected = sign(householdId);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { householdId };
}

export async function readSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function ensureSession(): Promise<Session> {
  const existing = await readSession();
  if (existing) return existing;
  const householdId = randomUUID();
  const store = await cookies();
  store.set(COOKIE_NAME, encode(householdId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return { householdId };
}

/** Route handlers cannot set cookies during render, so they use this instead. */
export function sessionCookie(householdId: string): {
  name: string;
  value: string;
  options: Record<string, unknown>;
} {
  return {
    name: COOKIE_NAME,
    value: encode(householdId),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  };
}

export { COOKIE_NAME };
