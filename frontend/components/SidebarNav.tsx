"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Home, MessageCircle, BarChart3, Compass, Wallet, LogOut } from "lucide-react";
import { useStore, type TabType } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import { useDisconnect } from "wagmi";

const tabs: { key: TabType; icon: typeof Home; labelKey: string }[] = [
  { key: "home", icon: Home, labelKey: "nav.home" },
  { key: "market", icon: BarChart3, labelKey: "nav.market" },
  { key: "chat", icon: MessageCircle, labelKey: "nav.chat" },
  { key: "discover", icon: Compass, labelKey: "nav.discover" },
  { key: "assets", icon: Wallet, labelKey: "nav.assets" },
];

export default function SidebarNav() {
  const { activeTab, switchTab, locale, unreadChatCount, logout, walletAddress } = useStore();
  const { disconnect } = useDisconnect();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    setLoggingOut(true);
    toast(t("common.loggingOut", locale), { duration: 1200 });
    setTimeout(() => {
      // Disconnect wagmi wallet first to clear connection state
      disconnect();
      // Clear login state
      logout();
      setLogoutDialogOpen(false);
      setLoggingOut(false);
      // Force redirect to login page with full page reload
      window.location.replace("./login.html");
    }, 800);
  };

  return (
    <aside className="hidden lg:flex flex-col w-60 xl:w-64 bg-card border-r border-border h-dvh flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-border">
        <div className="w-9 h-9 relative flex-shrink-0">
          <Image
            src="/logo/logo.png"
            alt="OGBOX Logo"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <span className="text-xl font-bold tracking-tight">OGBOX</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <li key={tab.key}>
                <button
                  onClick={() => switchTab(tab.key)}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative ${
                    isActive
                      ? "bg-[var(--ogbo-blue)]/10 text-[var(--ogbo-blue)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActiveIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[var(--ogbo-blue)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
                    {tab.key === "chat" && unreadChatCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-[var(--ogbo-red)] text-white text-[9px] font-bold flex items-center justify-center px-1">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                      </span>
                    )}
                  </div>
                  <span>{t(tab.labelKey, locale)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "---"}
            </p>
            <p className="text-[10px] text-muted-foreground">Ethereum</p>
          </div>
          <button
            onClick={() => setLogoutDialogOpen(true)}
            className="rounded-lg p-1.5 hover:bg-destructive/10 transition-colors group"
            aria-label={t("common.logout", locale)}
          >
            <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
          </button>
        </div>
      </div>

      {/* Logout confirmation dialog */}
      <AnimatePresence>
        {logoutDialogOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => !loggingOut && setLogoutDialogOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className="relative w-full max-w-xs rounded-2xl bg-card border border-border shadow-xl overflow-hidden"
            >
              <div className="flex flex-col items-center px-6 pt-6 pb-2">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="text-base font-semibold text-card-foreground">{t("common.logoutConfirmTitle", locale)}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 text-center leading-relaxed">{t("common.logoutConfirmDesc", locale)}</p>
              </div>
              <div className="flex gap-3 px-6 pt-4 pb-6">
                <button
                  onClick={() => setLogoutDialogOpen(false)}
                  disabled={loggingOut}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {t("common.logoutCancel", locale)}
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-70 flex items-center justify-center gap-1.5"
                >
                  {loggingOut ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full"
                    />
                  ) : (
                    t("common.logoutConfirm", locale)
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
