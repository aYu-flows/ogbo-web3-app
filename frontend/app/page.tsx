"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import SidebarNav from "@/components/SidebarNav";
import HomePage from "@/components/pages/HomePage";
import ChatPage from "@/components/pages/ChatPage";
import MarketPage from "@/components/pages/MarketPage";
import DiscoverPage from "@/components/pages/DiscoverPage";
import AssetsPage from "@/components/pages/AssetsPage";

export default function Page() {
  const { activeTab, isLoggedIn, checkAuthStatus } = useStore();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatNewOpen, setChatNewOpen] = useState(false);
  const [marketSearchOpen, setMarketSearchOpen] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    checkAuthStatus();

    // Small delay to ensure store is updated
    setTimeout(() => {
      setIsChecking(false);
    }, 100);
  }, [checkAuthStatus]);

  useEffect(() => {
    // Redirect to login if not logged in
    if (!isChecking && !isLoggedIn) {
      // Use window.location.replace for Capacitor compatibility
      window.location.replace("./login.html");
    }
  }, [isLoggedIn, isChecking]);

  const handleSearch = useCallback(() => {
    if (activeTab === "chat") setChatSearchOpen((p) => !p);
    if (activeTab === "market") setMarketSearchOpen((p) => !p);
  }, [activeTab]);

  const handleAdd = useCallback(() => {
    if (activeTab === "chat") setChatNewOpen(true);
  }, [activeTab]);

  // Show loading while checking auth status
  if (isChecking) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render main app if not logged in
  if (!isLoggedIn) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            background: "hsl(var(--card))",
            color: "hsl(var(--card-foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          },
        }}
      />

      {/* Desktop sidebar */}
      <SidebarNav />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar onSearch={handleSearch} onAdd={handleAdd} />

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              {activeTab === "home" && <HomePage />}
              {activeTab === "chat" && <ChatPage />}
              {activeTab === "market" && <MarketPage />}
              {activeTab === "discover" && <DiscoverPage />}
              {activeTab === "assets" && <AssetsPage />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom nav: mobile only */}
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
