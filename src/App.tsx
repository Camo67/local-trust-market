import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import SellPage from "./pages/SellPage";
import OrdersPage from "./pages/OrdersPage";
import InboxPage from "./pages/InboxPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import ChatPage from "./pages/ChatPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = () => {
  const location = useLocation();
  const hideNav = location.pathname.startsWith("/chat/");

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/listing/:id" element={<ListingDetailPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
