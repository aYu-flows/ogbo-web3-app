"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Send,
  Download,
  ArrowLeftRight,
  ShoppingCart,
  Users,
  TrendingUp,
  Compass,
  Video,
  ChevronRight,
  Shield,
  Star,
  X,
  Share2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";
import { LineChart, Line, ResponsiveContainer } from "recharts";

function AnimatedNumber({ value, visible }: { value: number; visible: boolean }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const end = value;
    const duration = 800;
    const startTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = end * eased;
      setDisplay(start);
      if (progress < 1) requestAnimationFrame(animate);
    };
    animate();
  }, [value, visible]);

  if (!visible) return <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight">******</span>;
  return (
    <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
      {"¥ " + display.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

// Send Modal
function SendModal({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: "zh" | "en" }) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-6 text-card-foreground"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted lg:hidden" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">{t("home.send", locale)}</h3>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {locale === "zh" ? "收款地址" : "Recipient Address"}
                </label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-[var(--ogbo-blue)] focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {locale === "zh" ? "选择资产" : "Select Asset"}
                </label>
                <select className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none">
                  <option>BTC</option>
                  <option>ETH</option>
                  <option>USDT</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  {locale === "zh" ? "数量" : "Amount"}
                </label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-[var(--ogbo-blue)] focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "网络费用: 0.0001 BTC" : "Network Fee: 0.0001 BTC"}
              </p>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-input bg-background py-3 text-sm font-medium hover:bg-muted transition-colors">
                  {t("common.cancel", locale)}
                </button>
                <button
                  onClick={() => {
                    toast.success(locale === "zh" ? "发送请求已提交" : "Send request submitted");
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-[var(--ogbo-blue)] py-3 text-sm font-medium text-white hover:bg-[var(--ogbo-blue-hover)] active:bg-[var(--ogbo-blue-active)] transition-colors"
                >
                  {t("common.confirm", locale)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Receive Modal
function ReceiveModal({ open, onClose, locale, address }: { open: boolean; onClose: () => void; locale: "zh" | "en"; address: string }) {
  if (!open) return null;
  const shortAddr = address.slice(0, 10) + "..." + address.slice(-8);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground text-center"
          >
            <h3 className="text-lg font-semibold mb-4">{t("home.receive", locale)}</h3>
            <div className="mx-auto mb-4 w-48 h-48 rounded-xl bg-foreground/5 flex items-center justify-center">
              <div className="w-36 h-36 bg-foreground/10 rounded-lg grid grid-cols-6 gap-0.5 p-2">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? "bg-foreground" : "bg-transparent"}`} />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3 font-mono">{shortAddr}</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(address);
                toast.success(t("assets.addressCopied", locale));
              }}
              className="rounded-xl bg-[var(--ogbo-blue)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors"
            >
              {t("assets.copyAddress", locale)}
            </button>
            <button onClick={onClose} className="mt-3 block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("common.close", locale)}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Swap Modal
function SwapModal({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: "zh" | "en" }) {
  const [fromToken, setFromToken] = useState("BTC");
  const [toToken, setToToken] = useState("ETH");
  const [fromAmount, setFromAmount] = useState("0.5");
  const swapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
  };
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end lg:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-6 text-card-foreground"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted lg:hidden" />
            <h3 className="text-lg font-semibold mb-6">{t("home.swap", locale)}</h3>
            <div className="space-y-2">
              <div className="rounded-xl bg-muted p-4">
                <label className="text-xs text-muted-foreground">{locale === "zh" ? "从" : "From"}</label>
                <div className="flex items-center gap-3 mt-2">
                  <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="rounded-lg bg-background px-3 py-2 text-sm font-medium border border-input">
                    <option>BTC</option><option>ETH</option><option>USDT</option><option>BNB</option>
                  </select>
                  <input value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} type="number" className="flex-1 text-right text-lg font-semibold bg-transparent outline-none" />
                </div>
              </div>
              <div className="flex justify-center">
                <motion.button
                  whileHover={{ rotate: 180 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={swapTokens}
                  className="rounded-full bg-[var(--ogbo-blue)] p-2 text-white shadow-fab"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </motion.button>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <label className="text-xs text-muted-foreground">{locale === "zh" ? "到" : "To"}</label>
                <div className="flex items-center gap-3 mt-2">
                  <select value={toToken} onChange={(e) => setToToken(e.target.value)} className="rounded-lg bg-background px-3 py-2 text-sm font-medium border border-input">
                    <option>ETH</option><option>BTC</option><option>USDT</option><option>BNB</option>
                  </select>
                  <span className="flex-1 text-right text-lg font-semibold text-muted-foreground">{"~ 8.3"}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground flex justify-between">
              <span>{locale === "zh" ? "汇率: 1 BTC = 16.6 ETH" : "Rate: 1 BTC = 16.6 ETH"}</span>
              <span>{locale === "zh" ? "手续费: 0.3%" : "Fee: 0.3%"}</span>
            </div>
            <button
              onClick={() => {
                toast.success(locale === "zh" ? "兑换请求已提交" : "Swap request submitted");
                onClose();
              }}
              className="mt-4 w-full rounded-xl bg-[var(--ogbo-blue)] py-3.5 text-sm font-medium text-white hover:bg-[var(--ogbo-blue-hover)] active:bg-[var(--ogbo-blue-active)] transition-colors"
            >
              {locale === "zh" ? "确认兑换" : "Confirm Swap"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Meeting Modal
function MeetingModal({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: "zh" | "en" }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-card-foreground"
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1 hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-cyan flex items-center justify-center">
                <Video className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">OGBOX Meeting</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {locale === "zh" ? "安全加密的Web3视频会议功能" : "Secure encrypted Web3 video conferencing"}
              </p>
              <ul className="text-left text-sm space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--ogbo-green)]" />
                  {locale === "zh" ? "端到端加密" : "End-to-end encryption"}
                </li>
                <li className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--ogbo-blue)]" />
                  {locale === "zh" ? "最多50人" : "Up to 50 participants"}
                </li>
                <li className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[var(--ogbo-purple)]" />
                  {locale === "zh" ? "屏幕共享" : "Screen sharing"}
                </li>
              </ul>
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 rounded-xl border border-input py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                  {t("common.close", locale)}
                </button>
                <button
                  onClick={() => {
                    toast.success(locale === "zh" ? "已加入测试等待列表" : "Joined the test waitlist");
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-[var(--ogbo-blue)] py-2.5 text-sm font-medium text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors"
                >
                  {locale === "zh" ? "加入测试" : "Join Test"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Coin Detail Modal
function CoinDetailModal({
  open,
  onClose,
  coin,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  coin: { symbol: string; name: string; price: number; change24h: number; chartData: { time: number; price: number }[] } | null;
  locale: "zh" | "en";
}) {
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
            className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-6 text-card-foreground max-h-[85vh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted lg:hidden" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{coin.symbol}/USDT</h3>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-4">
              <span className="text-2xl font-bold">${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className={`ml-2 text-sm font-medium ${isUp ? "text-[var(--ogbo-green)]" : "text-[var(--ogbo-red)]"}`}>
                {isUp ? "+" : ""}{coin.change24h.toFixed(2)}%
              </span>
            </div>
            <div className="h-40 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={coin.chartData}>
                  <Line type="monotone" dataKey="price" stroke={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2 mb-4">
              {["1H", "1D", "1W", "1M", "1Y"].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    timeframe === tf ? "bg-[var(--ogbo-blue)] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { toast(locale === "zh" ? "交易功能即将上线" : "Trading coming soon"); onClose(); }} className="flex-1 rounded-xl bg-[var(--ogbo-green)] py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                {t("home.buy", locale)}
              </button>
              <button onClick={() => { toast(locale === "zh" ? "交易功能即将上线" : "Trading coming soon"); onClose(); }} className="flex-1 rounded-xl bg-[var(--ogbo-red)] py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                {locale === "zh" ? "卖出" : "Sell"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function HomePage() {
  const { locale, isBalanceVisible, toggleBalance, coins, switchTab, updatePrices } = useStore();
  const wallet = useStore((s) => s.getCurrentWallet());
  const [sendOpen, setSendOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<typeof coins[0] | null>(null);

  useEffect(() => {
    const interval = setInterval(updatePrices, 3000);
    return () => clearInterval(interval);
  }, [updatePrices]);

  const topCoins = coins.slice(0, 5);

  const quickActions = [
    { icon: Send, label: t("home.send", locale), onClick: () => setSendOpen(true) },
    { icon: Download, label: t("home.receive", locale), onClick: () => setReceiveOpen(true) },
    { icon: ArrowLeftRight, label: t("home.swap", locale), onClick: () => setSwapOpen(true) },
    { icon: ShoppingCart, label: t("home.buy", locale), onClick: () => toast(t("common.comingSoon", locale)) },
  ];

  const featureCards = [
    {
      icon: Users,
      title: t("home.community", locale),
      desc: t("home.communityDesc", locale),
      gradient: "gradient-primary",
      badge: t("home.comingSoon", locale),
      badgeColor: "bg-[var(--ogbo-orange)]",
      onClick: () => toast(locale === "zh" ? "社区功能即将上线，敬请期待！" : "Community coming soon!"),
    },
    {
      icon: TrendingUp,
      title: t("home.trade", locale),
      desc: t("home.tradeDesc", locale),
      gradient: "gradient-green",
      badge: t("home.experience", locale),
      badgeColor: "bg-[var(--ogbo-green)]",
      onClick: () => setSwapOpen(true),
    },
    {
      icon: Compass,
      title: t("home.dapps", locale),
      desc: t("home.dappsDesc", locale),
      gradient: "gradient-pink",
      badge: null,
      badgeColor: "",
      onClick: () => switchTab("discover"),
    },
    {
      icon: Video,
      title: t("home.meeting", locale),
      desc: t("home.meetingDesc", locale),
      gradient: "gradient-cyan",
      badge: t("home.new", locale),
      badgeColor: "bg-[var(--ogbo-blue)]",
      onClick: () => setMeetingOpen(true),
    },
  ];

  const featuredDApps = [
    { name: "Uniswap", rating: 4.8, users: "1.2K", color: "#ff007a" },
    { name: "OpenSea", rating: 4.6, users: "980", color: "#2081e2" },
    { name: "AAVE", rating: 4.7, users: "756", color: "#b6509e" },
    { name: "PancakeSwap", rating: 4.4, users: "1.5K", color: "#d1884f" },
    { name: "1inch", rating: 4.5, users: "876", color: "#94a6c3" },
  ];

  const todayProfit = 1255.5;
  const todayProfitPercent = 1.02;

  return (
    <div className="pb-4 lg:pb-8 lg:max-w-5xl lg:mx-auto lg:w-full">
      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 lg:mx-6 rounded-2xl gradient-hero p-5 lg:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_50%)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/80 text-sm">{t("home.totalAssets", locale)}</span>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleBalance}
                className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
              >
                {isBalanceVisible ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, rotate: -15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => toast(locale === "zh" ? "分享功能开发中" : "Share feature coming soon")}
                className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Share2 className="w-4 h-4 text-white" />
              </motion.button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={isBalanceVisible ? "visible" : "hidden"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <AnimatedNumber value={wallet.balance.cny} visible={isBalanceVisible} />
              <p className="text-white/60 text-sm mt-0.5">
                {isBalanceVisible ? `≈ $${wallet.balance.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "≈ $****"}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2 flex items-center gap-1"
          >
            <span className="text-sm text-white/80">{t("home.todayProfit", locale)}:</span>
            <span className={`text-sm font-medium ${todayProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {todayProfit >= 0 ? "+" : ""}¥{isBalanceVisible ? todayProfit.toFixed(2) : "***"} ({todayProfitPercent >= 0 ? "+" : ""}{todayProfitPercent}%)
            </span>
            {todayProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-300" /> : null}
          </motion.div>

          <div className="flex gap-2 mt-4">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md py-2.5 hover:bg-white/25 active:bg-white/20 transition-colors"
              >
                <action.icon className="w-5 h-5 text-white" />
                <span className="text-xs text-white font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Feature Cards 2x2 on mobile, 4 on desktop */}
      <div className="mx-4 lg:mx-6 mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        {featureCards.map((card, i) => (
          <motion.button
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(0,0,0,0.1)" }}
            whileTap={{ scale: 0.98 }}
            onClick={card.onClick}
            className="text-left rounded-2xl bg-card p-4 shadow-card border border-border/50 transition-shadow relative overflow-hidden"
          >
            <div className={`w-11 h-11 rounded-xl ${card.gradient} flex items-center justify-center mb-3`}>
              <card.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-semibold text-card-foreground">{card.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
            {card.badge && (
              <span className={`absolute top-3 right-3 ${card.badgeColor} text-white text-[10px] px-2 py-0.5 rounded-full font-medium`}>
                {card.badge}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Featured DApps */}
      <div className="mt-6 lg:mt-8">
        <div className="flex items-center justify-between px-4 lg:px-6 mb-3">
          <h3 className="text-base lg:text-lg font-semibold">{t("home.featuredApps", locale)}</h3>
          <button onClick={() => switchTab("discover")} className="flex items-center text-sm text-muted-foreground hover:text-[var(--ogbo-blue)] transition-colors group">
            {t("home.viewAll", locale)}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <div className="flex gap-3 px-4 lg:px-6 overflow-x-auto hide-scrollbar pb-1 lg:grid lg:grid-cols-5">
          {featuredDApps.map((dapp, i) => (
            <motion.button
              key={dapp.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              whileHover={{ y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => switchTab("discover")}
              className="flex-shrink-0 w-28 lg:w-auto rounded-2xl bg-card p-3 shadow-card border border-border/50 text-center"
            >
              <div
                className="w-14 h-14 mx-auto rounded-2xl mb-2 flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: dapp.color }}
              >
                {dapp.name[0]}
              </div>
              <p className="text-xs font-medium text-card-foreground truncate">{dapp.name}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="w-3 h-3 text-[var(--ogbo-orange)] fill-[var(--ogbo-orange)]" />
                <span className="text-[10px] text-muted-foreground">{dapp.rating} | {dapp.users}</span>
              </div>
              <span
                className="mt-2 block w-full rounded-lg bg-[var(--ogbo-blue)] py-1 text-[10px] font-medium text-white text-center"
              >
                {t("common.open", locale)}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Market Overview */}
      <div className="mt-6 lg:mt-8">
        <div className="flex items-center justify-between px-4 lg:px-6 mb-3">
          <h3 className="text-base lg:text-lg font-semibold">{t("home.marketOverview", locale)}</h3>
          <button onClick={() => switchTab("market")} className="flex items-center text-sm text-muted-foreground hover:text-[var(--ogbo-blue)] transition-colors group">
            {t("home.viewMore", locale)}
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <div className="mx-4 lg:mx-6 space-y-2">
          {topCoins.map((coin, i) => {
            const isUp = coin.change24h >= 0;
            return (
              <motion.button
                key={coin.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.05 }}
                whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedCoin(coin)}
                className="w-full flex items-center gap-3 rounded-xl bg-card p-3 shadow-card border border-border/50 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-base font-bold flex-shrink-0">
                  {coin.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-card-foreground">{coin.symbol}</span>
                    <span className="text-sm font-semibold text-card-foreground">
                      ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{coin.name}</span>
                    <span className={`text-xs font-medium ${isUp ? "text-[var(--ogbo-green)]" : "text-[var(--ogbo-red)]"}`}>
                      {isUp ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div className="w-16 h-8 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={coin.chartData.slice(-12)}>
                      <Line type="monotone" dataKey="price" stroke={isUp ? "var(--ogbo-green)" : "var(--ogbo-red)"} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Security Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mx-4 lg:mx-6 mt-6 lg:mt-8 rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-4 lg:p-5 border border-blue-100 dark:border-blue-900/50"
      >
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[var(--ogbo-blue)] mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-[var(--ogbo-blue)]">{t("home.securityTip", locale)}</h4>
            <p className="text-xs text-muted-foreground mt-1">{t("home.securityDesc", locale)}</p>
            <button
              onClick={() => toast(locale === "zh" ? "安全知识页面开发中" : "Security knowledge page coming soon")}
              className="mt-2 text-xs text-[var(--ogbo-blue)] font-medium hover:underline flex items-center gap-0.5"
            >
              {t("home.learnMore", locale)}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modals */}
      <SendModal open={sendOpen} onClose={() => setSendOpen(false)} locale={locale} />
      <ReceiveModal open={receiveOpen} onClose={() => setReceiveOpen(false)} locale={locale} address={wallet.address} />
      <SwapModal open={swapOpen} onClose={() => setSwapOpen(false)} locale={locale} />
      <MeetingModal open={meetingOpen} onClose={() => setMeetingOpen(false)} locale={locale} />
      <CoinDetailModal open={!!selectedCoin} onClose={() => setSelectedCoin(null)} coin={selectedCoin} locale={locale} />
    </div>
  );
}
