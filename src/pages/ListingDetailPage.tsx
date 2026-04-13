import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MessageCircle, Shield } from "lucide-react";
import { MOCK_LISTINGS } from "@/data/mock";
import SellerBadge from "@/components/SellerBadge";
import EscrowBadge from "@/components/EscrowBadge";

const ListingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const listing = MOCK_LISTINGS.find((l) => l.id === id);

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Listing not found</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* Image */}
      <div className="relative">
        <img src={listing.image_url} alt={listing.title} className="w-full h-64 object-cover" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Title & Price */}
        <div>
          <h1 className="text-xl font-bold text-foreground">{listing.title}</h1>
          <p className="text-2xl font-bold text-primary mt-1">
            R {listing.price.toLocaleString("en-ZA")}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <SellerBadge level={listing.seller.level} />
          <EscrowBadge />
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-trust text-trust" />
            {listing.seller.rating} · {listing.seller.completed_sales} sales
          </span>
        </div>

        {/* Trust callout */}
        <div className="flex items-center gap-2 rounded-xl bg-escrow/10 px-3 py-2.5">
          <Shield className="h-5 w-5 text-escrow flex-shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Money held safely</span> until you confirm delivery. Do not pay outside the app.
          </p>
        </div>

        {/* Seller info */}
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {listing.seller.avatar_initials}
          </div>
          <div>
            <p className="font-semibold text-sm text-card-foreground">{listing.seller.name}</p>
            <p className="text-xs text-muted-foreground">{listing.location}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="font-semibold text-sm mb-1">Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
        </div>

        {/* Category & Location */}
        <div className="flex gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{listing.category}</span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{listing.location}</span>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-4 py-3 safe-bottom">
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/chat/new-${listing.id}`)}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-semibold text-primary"
          >
            <MessageCircle className="h-4 w-4" />
            Message
          </button>
          <button className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPage;
