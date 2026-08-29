import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Sign-in and sign-up both go through Logto's hosted sign-in experience —
// it presents both options (and password reset) on its own page, themed
// from the Logto Admin Console, then redirects back to /callback.
const AuthPage = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleContinue = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch (error: any) {
      toast({ title: "Couldn't start sign-in", description: error?.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Buddies Worldwide</h1>
          <p className="mt-1 text-sm text-muted-foreground">Safe local trading for everyone 🇿🇦</p>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Sign in or create account"}
        </button>

        <p className="text-sm text-muted-foreground">
          You'll continue to our sign-in page to enter your details or create a new account.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
