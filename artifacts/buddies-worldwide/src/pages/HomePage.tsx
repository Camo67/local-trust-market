import { Shield, LogOut, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import { useListings } from "@/hooks/useListings";
import { useAuth } from "@/contexts/AuthContext";

const HomePage = () => {
  const { data: listings, isLoading } = useListings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Buddies Worldwide</h1>
            <p className="text-sm text-muted-foreground">Connecting neighbors safely</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/verify")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
              title="Get Verified"
            >
              <BadgeCheck className="h-4 w-4" />
            </button>
            <button
              onClick={signOut}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-sm font-semibold text-primary"
              title="Sign out"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-escrow/10 px-3 py-2.5">
        <Shield className="h-5 w-5 text-escrow flex-shrink-0" />
        <p className="text-xs text-foreground">
          <span className="font-semibold">Your money is safe.</span> All payments are held in escrow until you confirm delivery.
        </p>
      </div>

      <main className="px-4">
        <h2 className="text-lg font-semibold mb-3">Near you</h2>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No listings yet. Be the first to sell something!</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
