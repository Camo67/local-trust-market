import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  isAdmin: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAdmin: false,
  loading: true,
  isAdmin: false,
  profileLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const updateAuthState = async (newSession: Session | null) => {
    // Only update if session changed to avoid redundant profile fetches
    if (newSession?.user?.id === user?.id && !!newSession === !!session) {
       setLoading(false);
       return;
    }

    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (newSession?.user) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", newSession.user.id)
          .maybeSingle();

        setIsAdmin(data?.is_admin ?? false);
      } catch (err) {
        console.error("Error fetching admin status:", err);
        setIsAdmin(false);
      }
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await fetchProfile(newUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await fetchProfile(newUser.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setIsAdmin(false);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        // SECURITY: We fetch the profile from a secured table to verify admin status.
        // Although RLS prevents users from modifying 'is_admin', we must verify it here
        // to protect the frontend administration interface.
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching profile:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data?.is_admin);
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setIsAdmin(false);
      } finally {
        setProfileLoading(false);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // If we have a user but haven't checked their profile yet, we MUST stay in a loading state
  // to prevent 'AdminRoute' from prematurely redirecting an admin user.
  const combinedLoading = loading || (!!user && profileLoading);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
