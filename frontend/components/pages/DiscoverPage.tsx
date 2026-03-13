"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Star, Heart, Clock, X, ChevronRight, ChevronLeft, Shield, Sparkles, Zap } from "lucide-react";
import { useStore, type DApp } from "@/lib/store";
import { useIMEInput } from "@/hooks/use-ime-input";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";

const categories = [
  { key: "all", label: { zh: "全部", en: "All" }, icon: "🌐" },
  { key: "DeFi", label: { zh: "DeFi", en: "DeFi" }, icon: "💰" },
  { key: "NFT", label: { zh: "NFT", en: "NFT" }, icon: "🖼" },
  { key: "GameFi", label: { zh: "GameFi", en: "GameFi" }, icon: "🎮" },
  { key: "Social", label: { zh: "社交", en: "Social" }, icon: "👥" },
  { key: "Tools", label: { zh: "工具", en: "Tools" }, icon: "🔧" },
  { key: "DAO", label: { zh: "DAO", en: "DAO" }, icon: "🏛" },
  { key: "Metaverse", label: { zh: "元宇宙", en: "Meta" }, icon: "🌌" },
];

const banners = [
  {
    title: { zh: "Uniswap V4 上线", en: "Uniswap V4 Launch" },
    desc: { zh: "立即体验最新功能", en: "Try the latest features now" },
    cta: { zh: "立即打开", en: "Open Now" },
    gradient: "from-[#ff007a] to-[#ff6b9d]",
  },
  {
    title: { zh: "OGBOX Meeting 内测", en: "OGBOX Meeting Beta" },
    desc: { zh: "邀请你加入Web3视频会议", en: "Join Web3 video conferencing" },
    cta: { zh: "申请体验", en: "Apply Now" },
    gradient: "from-[#0066FF] to-[#7C3AED]",
  },
  {
    title: { zh: "安全提示", en: "Security Tip" },
    desc: { zh: "使用DApp前请确认网址", en: "Verify URLs before using DApps" },
    cta: { zh: "了解更多", en: "Learn More" },
    gradient: "from-[#10B981] to-[#06B6D4]",
  },
];

function DAppDetailSheet({ open, onClose, dapp, locale }: { open: boolean; onClose: () => void; dapp: DApp | null; locale: "zh" | "en" }) {
  const { toggleDAppFavorite } = useStore();
  if (!open || !dapp) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-5 text-card-foreground max-h-[85vh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted lg:hidden" />

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg" style={{ backgroundColor: dapp.iconColor }}>
                {dapp.name[0]}
              </div>
              <h3 className="text-xl font-bold">{dapp.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(dapp.rating) ? "text-[var(--ogbo-orange)] fill-[var(--ogbo-orange)]" : "text-muted"}`} />
                ))}
                <span className="text-xs text-muted-foreground ml-1">{dapp.rating} ({dapp.downloads})</span>
              </div>
              <div className="flex gap-1.5 mt-3">
                {dapp.category.map((cat) => (
                  <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{cat}</span>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center mb-5">{dapp.description}</p>

            {/* Screenshots placeholder */}
            <div className="flex gap-2 mb-5 overflow-x-auto hide-scrollbar">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex-shrink-0 w-40 h-24 rounded-xl bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">{locale === "zh" ? `截图 ${s}` : `Screenshot ${s}`}</span>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground mb-5">
              <p>{locale === "zh" ? "开发者" : "Developer"}: {dapp.developer}</p>
              <p className="mt-0.5">{locale === "zh" ? "网站" : "Website"}: {dapp.url}</p>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  toggleDAppFavorite(dapp.id);
                  toast.success(dapp.favorited ? (locale === "zh" ? "已取消收藏" : "Unfavorited") : (locale === "zh" ? "已添加到收藏" : "Added to favorites"));
                }}
                className={`flex-1 rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  dapp.favorited ? "bg-red-50 text-[var(--ogbo-red)] border border-red-200 dark:bg-red-950/20 dark:border-red-900/50" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <Heart className={`w-4 h-4 ${dapp.favorited ? "fill-[var(--ogbo-red)]" : ""}`} />
                {dapp.favorited ? t("discover.favorited", locale) : t("discover.favorite", locale)}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => toast(t("discover.pendingIntegration", locale))}
                className="flex-1 rounded-xl bg-[var(--ogbo-blue)] py-3 text-sm font-medium text-white flex items-center justify-center gap-2 hover:bg-[var(--ogbo-blue-hover)] transition-colors"
              >
                <Clock className="w-4 h-4" />
                {t("discover.openApp", locale)}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function DiscoverPage() {
  const { dapps, locale, toggleDAppFavorite } = useStore();
  const { value: searchQuery, setValue: setSearchQuery, deferredValue: deferredSearch, getInputProps: getSearchInputProps } = useIMEInput("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDApp, setSelectedDApp] = useState<DApp | null>(null);
  const [activeBanner, setActiveBanner] = useState(0);

  // Auto-rotate banners
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredDApps = dapps.filter((d) => {
    const matchSearch = !deferredSearch || d.name.toLowerCase().includes(deferredSearch.toLowerCase()) || d.description.includes(deferredSearch);
    const matchCategory = selectedCategory === "all" || d.category.includes(selectedCategory);
    return matchSearch && matchCategory;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto lg:max-w-5xl lg:mx-auto lg:w-full">
      {/* Search */}
      <div className="px-4 lg:px-6 pt-2 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            {...getSearchInputProps()}
            placeholder={t("discover.searchDApp", locale)}
            className="w-full rounded-xl bg-muted pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-background transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Banner Carousel */}
      <div className="px-4 lg:px-6 mb-4">
        <div className="relative overflow-hidden rounded-2xl h-36 lg:h-44">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeBanner}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className={`absolute inset-0 bg-gradient-to-br ${banners[activeBanner].gradient} p-5 flex flex-col justify-between`}
            >
              <div>
                <h3 className="text-lg font-bold text-white">{banners[activeBanner].title[locale]}</h3>
                <p className="text-sm text-white/80 mt-1">{banners[activeBanner].desc[locale]}</p>
              </div>
              <button className="self-start rounded-full bg-white/20 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-white hover:bg-white/30 transition-colors">
                {banners[activeBanner].cta[locale]} <ChevronRight className="w-3 h-3 inline ml-0.5" />
              </button>
            </motion.div>
          </AnimatePresence>
          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setActiveBanner(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeBanner ? "bg-white w-4" : "bg-white/50"}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 lg:px-6 overflow-x-auto hide-scrollbar mb-4 lg:flex-wrap">
        {categories.map((cat) => (
          <motion.button
            key={cat.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(cat.key)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all ${
              selectedCategory === cat.key
                ? "bg-[var(--ogbo-blue)] text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <span className="text-lg">{cat.icon}</span>
            <span className="text-[10px] font-medium">{cat.label[locale]}</span>
          </motion.button>
        ))}
      </div>

      {/* DApps Grid */}
      <div className="px-4 lg:px-6 mb-3 flex items-center justify-between">
        <h3 className="text-sm lg:text-base font-semibold">{t("discover.popularApps", locale)}</h3>
        <button className="text-xs text-muted-foreground hover:text-[var(--ogbo-blue)] flex items-center transition-colors">
          {t("home.viewAll", locale)}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 lg:px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 pb-4">
        {filteredDApps.map((dapp, i) => (
          <motion.div
            key={dapp.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ y: -4, boxShadow: "0 8px 20px rgba(0,0,0,0.1)" }}
            className="rounded-2xl bg-card p-3 shadow-card border border-border/50 transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
                style={{ backgroundColor: dapp.iconColor }}
              >
                {dapp.name[0]}
              </motion.div>
              {dapp.featured && <Sparkles className="w-3.5 h-3.5 text-[var(--ogbo-orange)]" />}
            </div>
            <p className="text-sm font-semibold text-card-foreground truncate">{dapp.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-[var(--ogbo-orange)] fill-[var(--ogbo-orange)]" />
              <span className="text-[10px] text-muted-foreground">{dapp.rating} | {dapp.downloads}</span>
            </div>
            <div className="flex gap-1 mt-2">
              {dapp.category.slice(0, 2).map((cat) => (
                <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{cat}</span>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDAppFavorite(dapp.id);
                  toast.success(dapp.favorited ? (locale === "zh" ? "已取消收藏" : "Unfavorited") : (locale === "zh" ? "已收藏" : "Favorited"));
                }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--ogbo-red)] transition-colors"
              >
                <Heart className={`w-3.5 h-3.5 ${dapp.favorited ? "fill-[var(--ogbo-red)] text-[var(--ogbo-red)]" : ""}`} />
                {dapp.favorites}
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDApp(dapp)}
                className="rounded-lg bg-[var(--ogbo-blue)] px-3 py-1 text-[10px] font-medium text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors"
              >
                {t("discover.openApp", locale)}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      <DAppDetailSheet open={!!selectedDApp} onClose={() => setSelectedDApp(null)} dapp={selectedDApp} locale={locale} />
    </div>
  );
}
