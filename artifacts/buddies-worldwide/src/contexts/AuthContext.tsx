import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLogto, type IdTokenClaims } from "@logto/react";
import { supabase, setLogtoAccessTokenGetter } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Logto's `sub` is not the same string shape GoTrue used (it's not a UUID),
// but it's still the one stable, verified identifier for the signed-in
// user — everything downstream (RLS, FKs) is keyed on it as plain text now.
export interface AuthUser {
  id: string;
  email?: string;
}

const SUPABASE_RESOURCE = import.meta.env.VITE_SUPABASE_RESOURCE as string | undefined;

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  profileLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Access token scoped to the Supabase/PostgREST API resource, or undefined if signed out. */
  getAccessToken: () => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  profileLoading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  getAccessToken: async () => undefined,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    isAuthenticated,
    isLoading: logtoLoading,
    signIn: logtoSignIn,
    signOut: logtoSignOut,
    getIdTokenClaims,
    getAccessToken: logtoGetAccessToken,
  } = useLogto();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  // Guards against retrying ensure_own_profile in a loop if provisioning
  // ever fails for a given user within one session.
  const provisionedFor = useRef<string | null>(null);

  const getAccessToken = async (): Promise<string | undefined> => {
    if (!isAuthenticated) return undefined;
    return logtoGetAccessToken(SUPABASE_RESOURCE);
  };

  // The plain supabase-js singleton in client.ts can't call useLogto() itself
  // (it's created before React mounts), so hand it a live getter here.
  useEffect(() => {
    setLogtoAccessTokenGetter(getAccessToken);
  });

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (authUser: AuthUser, claims: IdTokenClaims) => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          return;
        }

        if (data) {
          if (!cancelled) {
            setProfile(data);
            setIsAdmin(!!data.is_admin);
          }
          return;
        }

        // No profiles row yet: Logto users aren't provisioned by a DB
        // trigger the way GoTrue users were. Create it once, ourselves.
        if (provisionedFor.current === authUser.id) return;
        provisionedFor.current = authUser.id;

        const displayName =
          claims.name ?? claims.username ?? (claims.email ? claims.email.split("@")[0] : undefined);

        const { data: created, error: rpcError } = await supabase.rpc("ensure_own_profile", {
          p_display_name: displayName ?? null,
        });

        if (rpcError) {
          console.error("Error provisioning profile:", rpcError);
          provisionedFor.current = null;
          return;
        }

        if (!cancelled) {
          setProfile(created);
          setIsAdmin(!!created?.is_admin);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    const sync = async () => {
      if (logtoLoading) return;

      if (!isAuthenticated) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setProfileLoading(false);
        return;
      }

      const claims = await getIdTokenClaims();
      if (!claims || cancelled) return;

      const nextUser: AuthUser = { id: claims.sub, email: claims.email ?? undefined };
      setUser(nextUser);
      await loadProfile(nextUser, claims);
    };

    sync();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, logtoLoading]);

  const refreshProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (error) {
      console.error("Error refreshing profile:", error);
      return;
    }
    setProfile(data);
    setIsAdmin(!!data?.is_admin);
  };

  const signIn = async () => {
    await logtoSignIn(`${window.location.origin}/callback`);
  };

  const signOut = async () => {
    await logtoSignOut(window.location.origin);
  };

  // Stay "loading" until Logto has resolved AND, for a signed-in user, the
  // profile fetch/provision has finished — otherwise ProtectedRoute could
  // redirect an admin away before we know they're an admin.
  const loading = logtoLoading || (isAuthenticated && profileLoading && !profile);

  return (
    <AuthContext.Provider
      value={{ user, profile, isAdmin, loading, profileLoading, signIn, signOut, refreshProfile, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};
