import { useOrders } from "@/hooks/useOrders";
import OrderTimeline from "@/components/OrderTimeline";

const OrdersPage = () => {
  const { data: orders, isLoading } = useOrders();

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">My Orders</h1>
      </header>

      <main className="px-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : orders && orders.length > 0 ? (
          orders.map((order: any) => (
            <div key={order.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {order.listing?.image_url ? (
                  <img src={order.listing.image_url} alt={order.listing.title} className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-muted" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-card-foreground truncate">{order.listing?.title || "Unknown"}</h3>
                  <p className="text-xs text-muted-foreground">
                    R {order.amount.toLocaleString("en-ZA")} · {order.seller_profile?.display_name || "Seller"}
                  </p>
                </div>
              </div>
              <OrderTimeline status={order.status} />
            </div>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default OrdersPage;
