import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var not set`);
  return value;
}

let _supabase: SupabaseClient | null = null;

/** Anon-key client, unauthenticated. Subject to RLS as an anonymous caller. */
export function getSupabase() {
  if (_supabase) return _supabase;
  _supabase = createClient(requiredEnv("VITE_SUPABASE_URL"), requiredEnv("VITE_SUPABASE_ANON_KEY"));
  return _supabase;
}

/**
 * Anon-key client that forwards the caller's own Logto access token, so
 * PostgREST/Storage-API see the request as that user and RLS applies
 * exactly as if the user had called Postgres themselves.
 */
export function getUserSupabase(accessToken: string) {
  return createClient(requiredEnv("VITE_SUPABASE_URL"), requiredEnv("VITE_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

let _serviceSupabase: SupabaseClient | null = null;

/**
 * Service-role client — bypasses RLS entirely. Only for operations that
 * legitimately need to act across users (e.g. reading another user's push
 * subscription to deliver a notification). Never expose this client's
 * results directly without an explicit authorization check first.
 */
export function getServiceSupabase() {
  if (_serviceSupabase) return _serviceSupabase;
  _serviceSupabase = createClient(requiredEnv("VITE_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _serviceSupabase;
}
