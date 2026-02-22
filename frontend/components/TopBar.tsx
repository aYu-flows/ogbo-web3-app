"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Globe, Bell, Search, Plus, LogOut, UserPlus, Users } from "lucide-react";
import { useStore, type TabType } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import { useDisconnect } from "wagmi";

const pageTitles: Record<TabType, { zh: string; en: string }> = {
  home: { zh: "OGBOX", en: "OGBOX" },
  chat: { zh: "聊天", en: "Chat" },
  market: { zh: "行情", en: "Market" },
  discover: { zh: "发现", en: "Discover" },
  assets: { zh: "资产", en: "Assets" },
};

export default function TopBar({
  onSearch,
  onAdd,
  onAddFriend,
  onCreateGroup,
}: {
  onSearch?: () => void;
  onAdd?: () => void;
  onAddFriend?: () => void;
  onCreateGroup?: () => void;
}) {
  const { activeTab, locale, switchLocale, notifications, logout } = useStore();
  const { disconnect } = useDisconnect();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
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

  const title = pageTitles[activeTab][locale];
  const isHome = activeTab === "home";

  return (
    <header className="relative bg-card border-b border-border z-30" style={{ paddingTop: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 21px)' }}>
      <div className="relative flex items-end justify-between px-4 lg:px-6 h-14 pb-3">
      {/* Left: Logo or Title */}
      <div className="flex items-center gap-2.5">
        {isHome ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative flex-shrink-0 lg:hidden">
              <Image
                src="/logo/logo.png"
                alt="OGBOX Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="text-lg font-bold tracking-tight">{title}</span>
          </div>
        ) : (
          <h1 className="text-lg font-bold">{title}</h1>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Search button for chat/market */}
        {(activeTab === "chat" || activeTab === "market") && onSearch && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onSearch}
            className="rounded-full p-2 hover:bg-muted transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-foreground" />
          </motion.button>
        )}

        {/* Add button for chat — dropdown with "Add Friend" + "New Group Chat" */}
        {activeTab === "chat" && (onAddFriend || onAdd || onCreateGroup) && (
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              className="rounded-full p-2 hover:bg-muted transition-colors"
              aria-label="Add"
            >
              <Plus className="w-5 h-5 text-foreground" />
            </motion.button>

            <AnimatePresence>
              {plusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPlusMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setPlusMenuOpen(false);
                        if (onAddFriend) onAddFriend();
                        else if (onAdd) onAdd();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <UserPlus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {t("chat.addFriend", locale)}
                    </button>
                    <div className="mx-3 h-px bg-border" />
                    <button
                      onClick={() => {
                        setPlusMenuOpen(false);
                        if (onCreateGroup) onCreateGroup();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {t("chat.createGroup", locale)}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Language switcher */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="flex items-center gap-1 rounded-full px-2 py-1.5 hover:bg-muted transition-colors"
            aria-label="Language"
          >
            <Globe className="w-4 h-4 text-foreground" />
            <span className="text-xs font-medium">{locale === "zh" ? "中" : "EN"}</span>
          </motion.button>

          <AnimatePresence>
            {langMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-32 rounded-xl bg-card border border-border shadow-lg z-50 overflow-hidden"
                >
                  <button
                    onClick={() => {
                      if (locale !== "zh") {
                        switchLocale();
                        toast.success("语言已切换到中文");
                      }
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                      locale === "zh" ? "text-[var(--ogbo-blue)] font-medium bg-[var(--ogbo-blue)]/5" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    中文 {locale === "zh" && "✓"}
                  </button>
                  <button
                    onClick={() => {
                      if (locale !== "en") {
                        switchLocale();
                        toast.success("Language changed to English");
                      }
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                      locale === "en" ? "text-[var(--ogbo-blue)] font-medium bg-[var(--ogbo-blue)]/5" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    English {locale === "en" && "✓"}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Notification bell */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => toast(locale === "zh" ? "暂无新通知" : "No new notifications")}
          className="relative rounded-full p-2 hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-foreground" />
          {notifications > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--ogbo-red)]" />
          )}
        </motion.button>

        {/* Logout button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setLogoutDialogOpen(true)}
          className="rounded-full p-2 hover:bg-destructive/10 transition-colors group"
          aria-label={t("common.logout", locale)}
        >
          <LogOut className="w-[18px] h-[18px] text-muted-foreground group-hover:text-destructive transition-colors" />
        </motion.button>
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
              {/* Header */}
              <div className="flex flex-col items-center px-6 pt-6 pb-2">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="text-base font-semibold text-card-foreground">{t("common.logoutConfirmTitle", locale)}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 text-center leading-relaxed">{t("common.logoutConfirmDesc", locale)}</p>
              </div>

              {/* Actions */}
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
      </div>
    </header>
  );
}
