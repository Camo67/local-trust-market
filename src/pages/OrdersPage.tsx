import { MOCK_ORDERS } from "@/data/mock";
import OrderTimeline from "@/components/OrderTimeline";

const OrdersPage = () => {
  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm px-4 pt-4 pb-3">
        <h1 className="text-xl font-semibold">My Orders</h1>
      </header>

      <main className="px-4 space-y-4">
        {MOCK_ORDERS.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No orders yet</p>
          </div>
        ) : (
          MOCK_ORDERS.map((order) => (
            <div key={order.id} className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={order.listing.image_url}
                  alt={order.listing.title}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-card-foreground truncate">
                    {order.listing.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    R {order.amount.toLocaleString("en-ZA")} · {order.listing.seller.name}
                  </p>
                </div>
              </div>
              <OrderTimeline status={order.status} />
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default OrdersPage;
