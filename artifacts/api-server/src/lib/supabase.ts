import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("Supabase env vars not set");
  _supabase = createClient(url, key);
  return _supabase;
}

export function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    // Fallback to anon key if service role is not provided,
    // but warn that cross-user pushes might fail with restricted RLS
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, using anon key for admin client");
    return getSupabase();
  }
  _supabaseAdmin = createClient(url, key);
  return _supabaseAdmin;
}
