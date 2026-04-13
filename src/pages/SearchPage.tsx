import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import ListingCard from "@/components/ListingCard";
import { MOCK_LISTINGS } from "@/data/mock";
import { CATEGORIES } from "@/types/marketplace";

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = MOCK_LISTINGS.filter((l) => {
    const matchesQuery = !query || l.title.toLowerCase().includes(query.toLowerCase()) || l.location.toLowerCase().includes(query.toLowerCase());
    const matchesCat = !selectedCategory || l.category === selectedCategory;
    return matchesQuery && matchesCat;
  });

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold mb-3">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items or locations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${cat === selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <main className="px-4">
        <p className="text-sm text-muted-foreground mb-3">{filtered.length} results</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items found. Try a different search.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SearchPage;
