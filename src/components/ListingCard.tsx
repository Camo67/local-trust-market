import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import type { Listing } from "@/types/marketplace";
import SellerBadge from "./SellerBadge";
import EscrowBadge from "./EscrowBadge";

const ListingCard = ({ listing }: { listing: Listing }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="w-full text-left bg-card rounded-2xl border-b-4 border-primary/10 shadow-sm overflow-hidden"
    >
      <img
        src={listing.image_url}
        alt={listing.title}
        className="w-full h-36 object-cover"
        loading="lazy"
      />
      <div className="p-3">
        <h3 className="font-semibold text-card-foreground leading-tight">{listing.title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {listing.seller.name} · {listing.location}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SellerBadge level={listing.seller.level} />
          <EscrowBadge small />
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-trust text-trust" />
            {listing.seller.rating}
          </span>
        </div>
        <p className="font-bold text-foreground mt-2">
          R {listing.price.toLocaleString("en-ZA")}
        </p>
      </div>
    </button>
  );
};

export default ListingCard;
