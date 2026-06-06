import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState<"reset" | "verify" | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const trimmedEmail = email.trim();
  const authRedirectUrl = window.location.origin;
  const resetRedirectUrl = `${window.location.origin}/reset-password`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: authRedirectUrl,
          },
        });
        if (error) throw error;
        if (data.user && data.user.identities?.length === 0) {
          setIsLogin(true);
          toast({
            title: "Account already exists",
            description: "Sign in with this email, or use Forgot password to reset it.",
          });
          return;
        }
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!trimmedEmail) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }

    setSecondaryLoading("reset");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: resetRedirectUrl,
      });
      if (error) throw error;
      toast({ title: "Reset email sent", description: "Open the link in your email to set a new password." });
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setSecondaryLoading(null);
    }
  };

  const handleResendVerification = async () => {
    if (!trimmedEmail) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }

    setSecondaryLoading("verify");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: { emailRedirectTo: authRedirectUrl },
      });
      if (error) throw error;
      toast({ title: "Verification email sent", description: "Check your inbox and spam folder." });
    } catch (error: any) {
      toast({ title: "Could not resend email", description: error.message, variant: "destructive" });
    } finally {
      setSecondaryLoading(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Buddies Worldwide</h1>
          <p className="mt-1 text-sm text-muted-foreground">Safe local trading for everyone 🇿🇦</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm font-medium text-foreground">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                required={!isLogin}
                className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {isLogin && (
          <div className="space-y-3 text-center text-sm">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={secondaryLoading !== null}
              className="font-semibold text-primary disabled:opacity-50"
            >
              {secondaryLoading === "reset" ? "Sending reset email..." : "Forgot password?"}
            </button>
            <div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={secondaryLoading !== null}
                className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
              >
                {secondaryLoading === "verify" ? "Sending verification email..." : "Resend verification email"}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-primary">
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
