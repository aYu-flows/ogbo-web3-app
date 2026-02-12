"use client";

import { motion } from "framer-motion";
import { Home, MessageCircle, BarChart3, Compass, Wallet } from "lucide-react";
import { useStore, type TabType } from "@/lib/store";
import { t } from "@/lib/i18n";

const tabs: { key: TabType; icon: typeof Home; labelKey: string }[] = [
  { key: "home", icon: Home, labelKey: "nav.home" },
  { key: "chat", icon: MessageCircle, labelKey: "nav.chat" },
  { key: "market", icon: BarChart3, labelKey: "nav.market" },
  { key: "discover", icon: Compass, labelKey: "nav.discover" },
  { key: "assets", icon: Wallet, labelKey: "nav.assets" },
];

export default function BottomNav() {
  const { activeTab, switchTab, locale, unreadChatCount } = useStore();

  return (
    <nav className="relative flex items-end bg-card border-t border-border" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              whileTap={{ scale: 0.9 }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 relative transition-colors"
              aria-label={t(tab.labelKey, locale)}
              role="tab"
              aria-selected={isActive}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-[var(--ogbo-blue)]" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {tab.key === "chat" && unreadChatCount > 0 && (
                  <motion.span
                    key={unreadChatCount}
                    initial={{ scale: 1.4 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 rounded-full bg-[var(--ogbo-red)] text-white text-[9px] font-bold flex items-center justify-center px-1"
                  >
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </motion.span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-[var(--ogbo-blue)]" : "text-muted-foreground"
                }`}
              >
                {t(tab.labelKey, locale)}
              </span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-full bg-[var(--ogbo-blue)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
