"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Star, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useStore, type Coin } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import { LineChart, Line, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis } from "recharts";

type MarketTab = "trending" | "favorites" | "gainers" | "losers";

function CoinDetailModal({ open, onClose, coin, locale }: { open: boolean; onClose: () => void; coin: Coin | null; locale: "zh" | "en" }) {
  const { toggleCoinFavorite } = useStore();
  const [timeframe, setTimeframe] = useState("1D");
  if (!open || !coin) return null;
  const isUp = coin.change24h >= 0;
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
            className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-5 text-card-foreground max-h-[90vh] overflow-y-auto"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted lg:hidden" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-bold">{coin.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold">{coin.symbol}/USDT</h3>
                  <p className="text-xs text-muted-foreground">{coin.name}</p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="mb-1">
              <span className="text-3xl font-bold">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-sm font-medium px-2 py-0.5 rounded-md ${isUp ? "bg-emerald-100 text-[var(--ogbo-green)] dark:bg-emerald-950/50" : "bg-red-100 text-[var(--ogbo-red)] dark:bg-red-950/50"}`}>
                {isUp ? "+" : ""}{coin.change24h.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">
                ≈ ¥{(coin.price * 7.13).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="h-48 mb-3 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={coin.chartData}>
                  <defs>
                    <linearGradient id={`gradient-${coin.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                  />
                  <Area type="monotone" dataKey="price" stroke={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} strokeWidth={2} fill={`url(#gradient-${coin.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-1.5 mb-5">
              {["1H", "1D", "1W", "1M", "1Y"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                    timeframe === tf ? "bg-[var(--ogbo-blue)] text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {[
                { label: t("market.high24h", locale), value: `$${coin.high24h.toLocaleString()}` },
                { label: t("market.low24h", locale), value: `$${coin.low24h.toLocaleString()}` },
                { label: t("market.volume24h", locale), value: coin.volume },
                { label: t("market.marketCap", locale), value: coin.marketCap },
                { label: t("market.supply", locale), value: coin.supply },
                { label: t("market.maxSupply", locale), value: coin.maxSupply },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-muted p-3">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                toggleCoinFavorite(coin.id);
                toast.success(coin.favorited ? (locale === "zh" ? "已取消自选" : "Removed from favorites") : (locale === "zh" ? "已添加到自选" : "Added to favorites"));
              }}
              className={`w-full rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 mb-3 transition-colors ${
                coin.favorited ? "bg-[var(--ogbo-orange)]/10 text-[var(--ogbo-orange)] border border-[var(--ogbo-orange)]/30" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Star className={`w-4 h-4 ${coin.favorited ? "fill-[var(--ogbo-orange)]" : ""}`} />
              {coin.favorited ? t("market.removeFavorite", locale) : t("market.addFavorite", locale)}
            </motion.button>

            <div className="flex gap-3">
              <button onClick={() => { toast(locale === "zh" ? "交易功能即将上线" : "Trading coming soon"); }} className="flex-1 rounded-xl bg-[var(--ogbo-green)] py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                {locale === "zh" ? "买入" : "Buy"}
              </button>
              <button onClick={() => { toast(locale === "zh" ? "交易功能即将上线" : "Trading coming soon"); }} className="flex-1 rounded-xl bg-[var(--ogbo-red)] py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                {locale === "zh" ? "卖出" : "Sell"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function MarketPage() {
  const { coins, locale, updatePrices, toggleCoinFavorite } = useStore();
  const [activeTab, setActiveTab] = useState<MarketTab>("trending");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);

  useEffect(() => {
    const interval = setInterval(updatePrices, 3000);
    return () => clearInterval(interval);
  }, [updatePrices]);

  const getFilteredCoins = () => {
    let filtered = coins;
    if (searchQuery) {
      filtered = coins.filter(
        (c) => c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    switch (activeTab) {
      case "favorites":
        return filtered.filter((c) => c.favorited);
      case "gainers":
        return [...filtered].sort((a, b) => b.change24h - a.change24h);
      case "losers":
        return [...filtered].sort((a, b) => a.change24h - b.change24h);
      default:
        return filtered;
    }
  };

  const filteredCoins = getFilteredCoins();

  const tabs: { key: MarketTab; label: string; icon?: typeof TrendingUp }[] = [
    { key: "trending", label: t("market.trending", locale) },
    { key: "favorites", label: t("market.favorites", locale) },
    { key: "gainers", label: t("market.topGainers", locale) },
    { key: "losers", label: t("market.topLosers", locale) },
  ];

  return (
    <div className="flex flex-col h-full lg:max-w-5xl lg:mx-auto lg:w-full">
      {/* Search */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 52, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pt-2 overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("market.searchCoin", locale)}
                className="w-full rounded-xl bg-muted pl-9 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all"
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-background transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex items-center px-4 lg:px-6 mt-2 mb-1 relative">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key ? "text-[var(--ogbo-blue)]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <motion.div
                layoutId="marketTabIndicator"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-[var(--ogbo-blue)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="flex items-center px-4 lg:px-6 py-2 text-[10px] lg:text-xs text-muted-foreground border-b border-border">
        <span className="flex-1">{locale === "zh" ? "币种" : "Coin"}</span>
        <span className="w-24 lg:w-32 text-right">{t("market.price", locale)}</span>
        <span className="w-20 lg:w-28 text-right">{t("market.change", locale)}</span>
      </div>

      {/* Coin list */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + searchQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Favorites empty state */}
            {activeTab === "favorites" && filteredCoins.length === 0 && !searchQuery && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <Star className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("market.noFavorites", locale)}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t("market.noFavoritesDesc", locale)}</p>
                <button onClick={() => setActiveTab("trending")} className="mt-4 rounded-xl bg-[var(--ogbo-blue)] px-6 py-2 text-sm text-white font-medium hover:bg-[var(--ogbo-blue-hover)] transition-colors">
                  {t("market.goAdd", locale)}
                </button>
              </div>
            )}

            {/* Search empty state */}
            {searchQuery && filteredCoins.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <Search className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("market.notFound", locale)}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t("market.tryOther", locale)}</p>
              </div>
            )}

            {filteredCoins.map((coin, i) => {
              const isUp = coin.change24h >= 0;
              return (
                <motion.button
                  key={coin.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedCoin(coin)}
                  className="w-full flex items-center px-4 lg:px-6 py-3 lg:py-4 hover:bg-muted/50 transition-colors text-left border-b border-border/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {coin.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{coin.symbol}</span>
                        {coin.favorited && <Star className="w-3 h-3 text-[var(--ogbo-orange)] fill-[var(--ogbo-orange)]" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                    </div>
                  </div>
                  <div className="w-24 lg:w-32 text-right">
                    <p className="text-sm lg:text-base font-semibold">${coin.price < 1 ? coin.price.toFixed(4) : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[10px] lg:text-xs text-muted-foreground">Vol: {coin.volume}</p>
                  </div>
                  <div className="w-20 lg:w-28 flex flex-col items-end gap-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                      isUp ? "bg-emerald-100 text-[var(--ogbo-green)] dark:bg-emerald-950/50" : "bg-red-100 text-[var(--ogbo-red)] dark:bg-red-950/50"
                    }`}>
                      {isUp ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </span>
                    <div className="w-14 h-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={coin.chartData.slice(-12)}>
                          <Line type="monotone" dataKey="price" stroke={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} strokeWidth={1} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <CoinDetailModal open={!!selectedCoin} onClose={() => setSelectedCoin(null)} coin={selectedCoin} locale={locale} />
    </div>
  );
}
