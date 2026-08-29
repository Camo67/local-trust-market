import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

// This client no longer authenticates itself via supabase.auth — Logto is
// the identity provider now (see AuthContext.tsx). Every request instead
// carries whatever access token this getter currently returns, verified on
// the server side by PostgREST/Storage-API against Logto's JWKS.
//
// It's a plain module-level function (not a hook) because this client is a
// singleton created at import time, before any React component — including
// LogtoProvider — has mounted. `AuthProvider` calls `setLogtoAccessTokenGetter`
// once it has a real `useLogto()`-backed getter to hand over. Until then,
// requests go out unauthenticated, same as a signed-out visitor.
let getLogtoAccessToken: () => Promise<string | undefined> = async () => undefined;

export function setLogtoAccessTokenGetter(getter: () => Promise<string | undefined>) {
  getLogtoAccessToken = getter;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => (await getLogtoAccessToken()) ?? null,
});
