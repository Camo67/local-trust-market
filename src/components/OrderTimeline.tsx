import { CheckCircle, Circle, Truck, Package, Wallet } from "lucide-react";
import type { Order } from "@/types/marketplace";

const steps = [
  { key: "pending", label: "Pending", icon: Circle },
  { key: "paid", label: "Paid (Escrow)", icon: Wallet },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
  { key: "completed", label: "Funds Released", icon: CheckCircle },
] as const;

const statusIndex: Record<string, number> = {
  pending: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
  completed: 4,
  disputed: -1,
};

const OrderTimeline = ({ status }: { status: Order["status"] }) => {
  const currentIdx = statusIndex[status];

  if (status === "disputed") {
    return (
      <div className="rounded-lg bg-destructive/10 p-3 text-center">
        <p className="text-sm font-semibold text-destructive">⚠️ Dispute Raised</p>
        <p className="text-xs text-muted-foreground mt-1">Our team is reviewing this order</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-escrow text-escrow-foreground" : "bg-muted text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <span className={`text-sm ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
            {i === currentIdx && (
              <span className="ml-auto text-[10px] font-medium text-escrow">Current</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
