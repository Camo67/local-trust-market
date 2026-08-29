import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, MessageCircle, Shield, ChevronLeft, ChevronRight, User } from "lucide-react";
import { useListing } from "@/hooks/useListings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SellerBadge from "@/components/SellerBadge";
import EscrowBadge from "@/components/EscrowBadge";
import { useToast } from "@/hooks/use-toast";

const ListingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: listing, isLoading } = useListing(id || "");
  const [imgIndex, setImgIndex] = useState(0);

  const handleMessage = async () => {
    if (!user || !listing) return;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", user.id)
      .maybeSingle();

    if (existing) { navigate(`/chat/${existing.id}`); return; }

    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({ listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id })
      .select("id")
      .single();

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    navigate(`/chat/${newConv.id}`);
  };

  if (isLoading) return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!listing) return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-muted-foreground">Listing not found</p>
    </div>
  );

  const images = listing.images && listing.images.length > 0 ? listing.images : (listing.image_url ? [listing.image_url] : []);
  const isOwnListing = user?.id === listing.seller_id;
  const sellerInitials = listing.seller?.display_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";

  return (
    <div className="pb-28">
      <div className="relative">
        {images.length > 0 ? (
          <div className="relative w-full h-64 bg-muted overflow-hidden">
            <img src={images[imgIndex]} alt={listing.title} className="w-full h-full object-cover" />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setImgIndex((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <button key={i} onClick={() => setImgIndex(i)} className={`h-1.5 rounded-full transition-all ${i === imgIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full h-64 bg-muted" />
        )}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        {images.length > 1 && (
          <span className="absolute top-4 right-4 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white font-medium">
            {imgIndex + 1}/{images.length}
          </span>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{listing.title}</h1>
          <p className="text-2xl font-bold text-primary mt-1">R {listing.price.toLocaleString("en-ZA")}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SellerBadge level={(listing.seller?.seller_level as any) || "basic"} />
          <EscrowBadge />
          {listing.seller && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-trust text-trust" />
              {Number(listing.seller.rating).toFixed(1)} · {listing.seller.completed_sales} sales
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-escrow/10 px-3 py-2.5">
          <Shield className="h-5 w-5 text-escrow flex-shrink-0" />
          <p className="text-xs text-foreground">
            <span className="font-semibold">Money held safely</span> until you confirm delivery. Do not pay outside the app.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary overflow-hidden">
            {listing.seller?.avatar_url ? (
              <img src={listing.seller.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              sellerInitials
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-card-foreground">{listing.seller?.display_name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{listing.location}</p>
          </div>
        </div>

        {listing.description && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{listing.description}</p>
          </div>
        )}
      </div>

      {!isOwnListing && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border safe-bottom">
          <button
            onClick={handleMessage}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            Message Seller
          </button>
        </div>
      )}
    </div>
  );
};

export default ListingDetailPage;
