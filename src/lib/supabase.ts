import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_MODE } from "@/lib/config";

let client: SupabaseClient | null | undefined;

function credentials(): { url: string; secret: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
  return url && secret ? { url, secret } : null;
}

/**
 * The privileged client is server-only. Every caller must scope household
 * queries with the id from the verified signed cookie; the secret is never
 * imported by a Client Component or returned from an API route.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (DEMO_MODE) return null;
  if (client !== undefined) return client;

  const config = credentials();
  if (!config) {
    client = null;
    return client;
  }

  client = createClient(config.url, config.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function hasSupabasePersistence(): boolean {
  return supabaseAdmin() !== null;
}
