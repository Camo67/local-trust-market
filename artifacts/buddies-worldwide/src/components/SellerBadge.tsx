import { Shield, CheckCircle } from "lucide-react";

const sellerLevelConfig = {
  basic: { label: "Basic", className: "bg-muted text-muted-foreground" },
  verified: { label: "Verified", className: "bg-trust/20 text-trust-foreground", icon: CheckCircle },
  trusted: { label: "Trusted", className: "bg-escrow/15 text-foreground", icon: Shield },
};

const SellerBadge = ({ level }: { level: "basic" | "verified" | "trusted" }) => {
  const config = sellerLevelConfig[level] ?? sellerLevelConfig.basic;
  const Icon = "icon" in config ? config.icon : null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
};

export default SellerBadge;
