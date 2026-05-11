import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env["VITE_SUPABASE_URL"];
  const key = process.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !key) {
    throw new Error("Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set");
  }
  _supabase = createClient(url, key);
  return _supabase;
}
