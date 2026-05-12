import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
