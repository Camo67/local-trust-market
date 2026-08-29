import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { LogtoProvider, type LogtoConfig } from "@logto/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UnreadProvider } from "@/contexts/UnreadContext";
import BottomNav from "@/components/BottomNav";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import SellPage from "./pages/SellPage";
import OrdersPage from "./pages/OrdersPage";
import InboxPage from "./pages/InboxPage";
import ListingDetailPage from "./pages/ListingDetailPage";
import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage";
import CallbackPage from "./pages/CallbackPage";
import VerifyPage from "./pages/VerifyPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT as string,
  appId: import.meta.env.VITE_LOGTO_APP_ID as string,
  resources: (import.meta.env.VITE_SUPABASE_RESOURCE as string | undefined)
    ? [import.meta.env.VITE_SUPABASE_RESOURCE as string]
    : [],
};

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // SECURITY: Defense-in-depth. We prevent non-admin users from accessing
  // admin routes at the routing level, complementing DB RLS policies.
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

const AppLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const hideNav =
    location.pathname.startsWith("/chat/") ||
    location.pathname === "/auth" ||
    location.pathname === "/callback" ||
    location.pathname === "/admin";

  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
        <Route path="/sell" element={<ProtectedRoute><SellPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
        <Route path="/listing/:id" element={<ProtectedRoute><ListingDetailPage /></ProtectedRoute>} />
        <Route path="/chat/:id" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/verify" element={<ProtectedRoute><VerifyPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideNav && user && <BottomNav />}
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <LogtoProvider config={logtoConfig}>
          <AuthProvider>
            <UnreadProvider>
              <AppLayout />
            </UnreadProvider>
          </AuthProvider>
        </LogtoProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
