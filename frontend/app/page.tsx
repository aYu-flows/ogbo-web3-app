"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { useAccount, useWalletClient } from "wagmi";
import { useStore } from "@/lib/store";
import { walletClientToSigner } from "@/lib/wagmi";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import SidebarNav from "@/components/SidebarNav";
import HomePage from "@/components/pages/HomePage";
import ChatPage from "@/components/pages/ChatPage";
import MarketPage from "@/components/pages/MarketPage";
import DiscoverPage from "@/components/pages/DiscoverPage";
import AssetsPage from "@/components/pages/AssetsPage";
import AppDownloadBanner from "@/components/AppDownloadBanner";
import StatusBarConfig from "@/components/StatusBarConfig";
import AddFriendModal from "@/components/chat/AddFriendModal";

export default function Page() {
  const { activeTab, isLoggedIn, checkAuthStatus, initPush, pushInitialized, isConnectingPush, pushInitFailed, destroyPush, walletAddress, login } = useStore();
  const [isChecking, setIsChecking] = useState(true);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [marketSearchOpen, setMarketSearchOpen] = useState(false);

  // Wagmi wallet state
  const { address: wagmiAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    checkAuthStatus();
    setTimeout(() => setIsChecking(false), 100);
  }, [checkAuthStatus]);

  useEffect(() => {
    if (!isChecking && !isLoggedIn) {
      window.location.replace("./login.html");
    }
  }, [isLoggedIn, isChecking]);

  // Sync wagmi wallet address to store when connected
  useEffect(() => {
    if (isConnected && wagmiAddress && isLoggedIn) {
      if (!walletAddress || walletAddress.toLowerCase() !== wagmiAddress.toLowerCase()) {
        login(wagmiAddress);
      }
    }
  }, [isConnected, wagmiAddress, isLoggedIn]);

  // Auto-initialize Push Protocol when wallet is connected and user is logged in
  useEffect(() => {
    if (!isLoggedIn || !isConnected || !walletClient || pushInitialized || isConnectingPush || pushInitFailed) return;
    walletClientToSigner(walletClient)
      .then((signer) => initPush(signer))
      .catch(console.error);
  }, [isLoggedIn, isConnected, walletClient, pushInitialized, pushInitFailed]);

  // For local wallet login: initialize Push Protocol using sessionStorage private key
  useEffect(() => {
    if (!isLoggedIn || isConnected || pushInitialized || isConnectingPush || pushInitFailed) return;
    // Only runs when user is logged in but no wagmi wallet is connected (local wallet flow)
    Promise.all([
      import('@/lib/walletCrypto'),
      import('ethers'),
    ]).then(([{ getSessionWallet }, { ethers }]) => {
      const localWallet = getSessionWallet();
      if (localWallet) {
        const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/eth');
        const signer = localWallet.connect(provider);
        initPush(signer).catch(console.error);
      }
    }).catch(console.error);
  }, [isLoggedIn, isConnected, pushInitialized, isConnectingPush, pushInitFailed]);

  // Destroy Push when wallet disconnects
  useEffect(() => {
    if (isLoggedIn && !isConnected && pushInitialized) {
      destroyPush();
    }
  }, [isConnected, isLoggedIn, pushInitialized]);

  const handleSearch = useCallback(() => {
    if (activeTab === "chat") setChatSearchOpen((p) => !p);
    if (activeTab === "market") setMarketSearchOpen((p) => !p);
  }, [activeTab]);

  const handleAddFriend = useCallback(() => {
    setAddFriendOpen(true);
  }, []);

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
      <StatusBarConfig />
      <AppDownloadBanner />

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

      <SidebarNav />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <TopBar
          onSearch={handleSearch}
          onAddFriend={handleAddFriend}
        />

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
              {activeTab === "chat" && <ChatPage searchOpen={chatSearchOpen} onCloseSearch={() => setChatSearchOpen(false)} />}
              {activeTab === "market" && <MarketPage />}
              {activeTab === "discover" && <DiscoverPage />}
              {activeTab === "assets" && <AssetsPage />}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>

      {/* Add Friend Modal - global, accessible from TopBar */}
      <AddFriendModal isOpen={addFriendOpen} onClose={() => setAddFriendOpen(false)} />
    </div>
  );
}
