import { Home, Search, PlusCircle, Package, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Search, label: "Search", path: "/search" },
  { icon: PlusCircle, label: "Sell", path: "/sell", special: true },
  { icon: Package, label: "Orders", path: "/orders" },
  { icon: MessageCircle, label: "Inbox", path: "/inbox" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;

          if (tab.special) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center -mt-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="mt-1 text-[10px] font-semibold uppercase text-primary">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
