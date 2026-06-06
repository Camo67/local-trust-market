import { Star, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ListingWithSeller } from "@/hooks/useListings";
import SellerBadge from "./SellerBadge";
import EscrowBadge from "./EscrowBadge";

const ListingCard = ({ listing }: { listing: ListingWithSeller }) => {
  const navigate = useNavigate();
  const displayImage = listing.images?.[0] ?? listing.image_url;
  const sellerInitials = listing.seller?.display_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <button
      onClick={() => navigate(`/listing/${listing.id}`)}
      className="w-full text-left bg-card rounded-2xl border-b-4 border-primary/10 shadow-sm overflow-hidden"
    >
      {displayImage ? (
        <div className="relative w-full h-36">
          <img src={displayImage} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
          {listing.images && listing.images.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white font-medium">
              +${listing.images.length - 1}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full h-36 bg-muted flex items-center justify-center text-muted-foreground text-sm">No image</div>
      )}
      <div className="p-3">
        <h3 className="font-semibold text-card-foreground leading-tight truncate">{listing.title}</h3>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            {listing.seller?.avatar_url ? (
              <img src={listing.seller.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[8px] font-bold text-primary">{sellerInitials}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{listing.seller?.display_name || "Unknown"} · {listing.location}</p>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <SellerBadge level={(listing.seller?.seller_level as any) || "basic"} />
          <EscrowBadge small />
          {listing.seller && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-trust text-trust" />
              {Number(listing.seller.rating).toFixed(1)}
            </span>
          )}
        </div>
        <p className="font-bold text-foreground mt-2">R {listing.price.toLocaleString("en-ZA")}</p>
      </div>
    </button>
  );
};

export default ListingCard;
