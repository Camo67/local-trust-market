import { Shield } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { MOCK_LISTINGS } from "@/data/mock";

const HomePage = () => {
  return (
    <div className="pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Buddies Worldwide
            </h1>
            <p className="text-sm text-muted-foreground">
              Connecting neighbors safely
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-sm font-semibold text-primary">
            TB
          </div>
        </div>
      </header>

      {/* Trust banner */}
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-escrow/10 px-3 py-2.5">
        <Shield className="h-5 w-5 text-escrow flex-shrink-0" />
        <p className="text-xs text-foreground">
          <span className="font-semibold">Your money is safe.</span> All payments are held in escrow until you confirm delivery.
        </p>
      </div>

      {/* Listings */}
      <main className="px-4">
        <h2 className="text-lg font-semibold mb-3">Near you</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MOCK_LISTINGS.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
