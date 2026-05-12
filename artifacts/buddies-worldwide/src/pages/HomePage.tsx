import { BadgeCheck, Handshake, Search, Shield, Store, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ListingCard from "@/components/ListingCard";
import { useListings } from "@/hooks/useListings";
import { useAuth } from "@/contexts/AuthContext";

const purposePoints = [
  {
    icon: Shield,
    title: "Safer local deals",
    text: "Payments stay protected while buyers and sellers confirm delivery.",
  },
  {
    icon: BadgeCheck,
    title: "Real people first",
    text: "Verification helps the community trade with more confidence.",
  },
  {
    icon: Handshake,
    title: "Built for neighbors",
    text: "Buddies Worldwide exists to make everyday buying and selling feel less risky and more human.",
  },
];

const HomePage = () => {
  const { data: listings, isLoading } = useListings();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 px-4 pt-4 pb-3 backdrop-blur-sm lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">Buddies Worldwide</h1>
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

      <section className="border-b border-border/70 bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-10">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-xs font-semibold uppercase text-primary">Why Buddies Worldwide exists</p>
            <h2 className="max-w-3xl text-3xl font-bold leading-tight text-foreground lg:text-5xl">
              A safer marketplace for people who want to trade with trust.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg">
              Buddies Worldwide helps neighbors buy and sell without the usual uncertainty. The goal is simple: protect
              payments, encourage verified profiles, and keep conversations inside one trusted place.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/sell")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Store className="h-4 w-4" />
                Sell something
              </button>
              <button
                onClick={() => navigate("/search")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground"
              >
                <Search className="h-4 w-4" />
                Browse marketplace
              </button>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-background lg:block">
            <img
              src="/Buddies_worldwide_online_logo_2K_202605111701.jpeg"
              alt="Buddies Worldwide"
              className="h-full min-h-[320px] w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-4 py-4 lg:grid-cols-3 lg:px-8 lg:py-6">
        {purposePoints.map((point) => {
          const Icon = point.icon;
          return (
            <div key={point.title} className="rounded-xl border border-border bg-card px-4 py-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-escrow/10 text-escrow">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{point.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{point.text}</p>
            </div>
          );
        })}
      </section>

      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-escrow/10 px-3 py-2.5">
          <Shield className="h-5 w-5 flex-shrink-0 text-escrow" />
          <p className="text-xs text-foreground lg:text-sm">
            <span className="font-semibold">Your money is safe.</span> All payments are held in escrow until you confirm delivery.
          </p>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-semibold lg:text-2xl">Near you</h2>
            <p className="text-sm text-muted-foreground">Fresh listings from the Buddies Worldwide community.</p>
          </div>
          <button
            onClick={() => navigate("/verify")}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
          >
            <BadgeCheck className="h-4 w-4 text-primary" />
            Get verified
          </button>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-5 py-8 text-center lg:px-8 lg:py-12">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Help start the local marketplace</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              There are no active listings yet. Add the first item, invite a trusted seller, or complete verification so
              people know they are dealing with a real person.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/sell")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Store className="h-4 w-4" />
                Create first listing
              </button>
              <button
                onClick={() => navigate("/verify")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground"
              >
                <BadgeCheck className="h-4 w-4" />
                Verify your profile
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
