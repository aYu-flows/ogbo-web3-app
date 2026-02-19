"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Send,
  Download,
  ArrowLeftRight,
  Plus,
  ChevronRight,
  ExternalLink,
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  ImageIcon,
} from "lucide-react";
import { useStore, type Transaction, type NFT } from "@/lib/store";
import { t } from "@/lib/i18n";
import toast from "react-hot-toast";

function formatTimeAgo(ts: number, locale: "zh" | "en") {
  const diff = Date.now() - ts;
  if (diff < 60000) return locale === "zh" ? "刚刚" : "Just now";
  if (diff < 3600000) return locale === "zh" ? `${Math.floor(diff / 60000)}分钟前` : `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return locale === "zh" ? `${Math.floor(diff / 3600000)}小时前` : `${Math.floor(diff / 3600000)}h ago`;
  return locale === "zh" ? `${Math.floor(diff / 86400000)}天前` : `${Math.floor(diff / 86400000)}d ago`;
}

function TxIcon({ type }: { type: "send" | "receive" | "swap" }) {
  if (type === "send") return <ArrowUpRight className="w-4 h-4 text-[var(--ogbo-red)]" />;
  if (type === "receive") return <ArrowDownLeft className="w-4 h-4 text-[var(--ogbo-green)]" />;
  return <Repeat className="w-4 h-4 text-[var(--ogbo-blue)]" />;
}

function TxDetailModal({ open, onClose, tx, locale }: { open: boolean; onClose: () => void; tx: Transaction | null; locale: "zh" | "en" }) {
  if (!open || !tx) return null;
  const typeLabel = tx.type === "send" ? (locale === "zh" ? "发送" : "Send") : tx.type === "receive" ? (locale === "zh" ? "接收" : "Receive") : (locale === "zh" ? "兑换" : "Swap");
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold">{t("assets.txDetail", locale)}</h3>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-center mb-5">
              <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                tx.status === "completed" ? "bg-emerald-100 dark:bg-emerald-950/50" : "bg-amber-100 dark:bg-amber-950/50"
              }`}>
                <Check className={`w-6 h-6 ${tx.status === "completed" ? "text-[var(--ogbo-green)]" : "text-[var(--ogbo-orange)]"}`} />
              </div>
              <p className="text-sm font-medium text-[var(--ogbo-green)]">
                {tx.status === "completed" ? t("assets.completed", locale) : t("assets.pending", locale)}
              </p>
            </div>
            <div className="text-center mb-5">
              <p className="text-xs text-muted-foreground">{typeLabel}</p>
              <p className={`text-2xl font-bold ${tx.amount < 0 ? "text-[var(--ogbo-red)]" : "text-[var(--ogbo-green)]"}`}>
                {tx.amount > 0 ? "+" : ""}{tx.amount} {tx.symbol}
              </p>
            </div>
            <div className="space-y-3 text-sm">
              {tx.to && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("assets.to", locale)}</span>
                  <span className="font-mono text-xs">{tx.to}</span>
                </div>
              )}
              {tx.from && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("assets.from", locale)}</span>
                  <span className="font-mono text-xs">{tx.from}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{locale === "zh" ? "时间" : "Time"}</span>
                <span className="text-xs">{new Date(tx.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("assets.network", locale)}</span>
                <span className="text-xs">Ethereum</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("assets.gas", locale)}</span>
                <span className="text-xs">0.0012 ETH</span>
              </div>
            </div>
            <button
              onClick={() => toast(locale === "zh" ? "即将打开区块浏览器" : "Opening block explorer")}
              className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t("assets.explorer", locale)}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NFTDetailModal({ open, onClose, nft, locale }: { open: boolean; onClose: () => void; nft: NFT | null; locale: "zh" | "en" }) {
  if (!open || !nft) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-sm rounded-2xl bg-card p-5 text-card-foreground"
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-1 hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
            <div className="w-full aspect-square rounded-xl mb-4 flex items-center justify-center text-6xl" style={{ backgroundColor: nft.color + "20" }}>
              <span style={{ color: nft.color }}>NFT</span>
            </div>
            <h3 className="text-lg font-bold">{nft.name}</h3>
            <p className="text-sm text-muted-foreground">{nft.collection}</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{locale === "zh" ? "属性" : "Traits"}</span>
                <span>3</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">{t("assets.floorPrice", locale)}</span>
                <span className="font-semibold">{nft.floorPrice} ETH</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => toast(locale === "zh" ? "即将跳转到OpenSea" : "Opening on OpenSea")}
                className="flex-1 rounded-xl bg-[var(--ogbo-blue)] py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 hover:bg-[var(--ogbo-blue-hover)] transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> OpenSea
              </button>
              <button onClick={() => toast(t("common.comingSoon", locale))} className="rounded-xl px-4 py-2.5 bg-muted text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AssetsPage() {
  const { locale, isBalanceVisible, toggleBalance, wallets, currentWalletId, switchWallet, switchTab } = useStore();
  const wallet = useStore((s) => s.getCurrentWallet());
  const [copied, setCopied] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  const shortAddr = wallet.address.slice(0, 6) + "..." + wallet.address.slice(-4);

  const handleCopy = () => {
    navigator.clipboard?.writeText(wallet.address);
    setCopied(true);
    toast.success(t("assets.addressCopied", locale));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-4 lg:pb-8 overflow-y-auto lg:max-w-5xl lg:mx-auto lg:w-full">
      {/* Wallet Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 lg:mx-6 rounded-2xl gradient-primary p-5 lg:p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_30%,white_0%,transparent_50%)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-white/90 text-sm font-medium">{wallet.name}</span>
              <button onClick={() => setWalletMenuOpen(true)} className="text-white/60 text-xs">{"▼"}</button>
            </div>
            <div className="flex gap-1.5">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCopy}
                className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-white" />}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleBalance}
                className="rounded-full p-1.5 bg-white/10 hover:bg-white/20 transition-colors"
              >
                {isBalanceVisible ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
              </motion.button>
            </div>
          </div>
          <p className="text-white/50 text-xs font-mono mb-3">{shortAddr}</p>

          <p className="text-white/70 text-xs mb-1">{t("home.totalAssets", locale)}</p>
          <AnimatePresence mode="wait">
            <motion.div key={isBalanceVisible ? "show" : "hide"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="text-3xl lg:text-4xl font-bold text-white">
                {isBalanceVisible ? `¥ ${wallet.balance.cny.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "¥ ******"}
              </p>
              <p className="text-sm text-white/60 mt-0.5">
                {isBalanceVisible ? `≈ $${wallet.balance.usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "≈ $****"}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-2 mt-4">
            {[
              { icon: Send, label: t("home.send", locale) },
              { icon: Download, label: t("home.receive", locale) },
              { icon: ArrowLeftRight, label: t("home.swap", locale) },
            ].map((action) => (
              <motion.button
                key={action.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toast(t("common.comingSoon", locale))}
                className="flex-1 flex flex-col items-center gap-1.5 rounded-xl bg-white/15 backdrop-blur-md py-2 hover:bg-white/25 transition-colors"
              >
                <action.icon className="w-4 h-4 text-white" />
                <span className="text-[10px] text-white font-medium">{action.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Wallet Selector Menu */}
      <AnimatePresence>
        {walletMenuOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setWalletMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xs rounded-2xl bg-card p-4 text-card-foreground"
            >
              <h4 className="text-sm font-semibold mb-3">{t("assets.myWallets", locale)}</h4>
              <div className="space-y-2 mb-3">
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => { switchWallet(w.id); setWalletMenuOpen(false); toast.success(`${t("common.switchedTo", locale)} ${w.name}`); }}
                    className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${w.id === currentWalletId ? "bg-[var(--ogbo-blue)]/10 border border-[var(--ogbo-blue)]/30" : "hover:bg-muted"}`}
                  >
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{w.address.slice(0, 8)}...{w.address.slice(-4)}</p>
                    </div>
                    {w.id === currentWalletId && <Check className="w-4 h-4 text-[var(--ogbo-blue)]" />}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { toast(t("common.comingSoon", locale)); setWalletMenuOpen(false); }} className="flex-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">
                  + {t("assets.importWallet", locale)}
                </button>
                <button onClick={() => { toast(t("common.comingSoon", locale)); setWalletMenuOpen(false); }} className="flex-1 rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors">
                  + {t("assets.createWallet", locale)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token List */}
      <div className="mt-5 lg:mt-6 mx-4 lg:mx-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">{t("assets.myAssets", locale)}</h3>
          <button onClick={() => toast(t("common.comingSoon", locale))} className="rounded-full p-1 hover:bg-muted transition-colors">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          {wallet.tokens.map((token, i) => (
            <motion.button
              key={token.symbol}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
              whileTap={{ scale: 0.99 }}
              onClick={() => switchTab("market")}
              className="w-full flex items-center gap-3 lg:gap-4 rounded-xl bg-card p-3 lg:p-4 shadow-card border border-border/50 text-left group"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-muted flex items-center justify-center text-sm lg:text-base font-bold flex-shrink-0">
                {token.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{token.symbol}</span>
                  <span className="text-sm font-semibold">
                    {isBalanceVisible ? `${token.amount} ${token.symbol}` : "****"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{token.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isBalanceVisible ? `¥${token.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "¥****"}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* NFT Collection */}
      <div className="mt-6 lg:mt-8 mx-4 lg:mx-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm lg:text-base font-semibold">{t("assets.nftCollection", locale)}</h3>
          <button onClick={() => switchTab("discover")} className="text-xs text-muted-foreground hover:text-[var(--ogbo-blue)] flex items-center transition-colors">
            {t("home.viewAll", locale)}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {wallet.nfts.length === 0 ? (
          <div className="flex flex-col items-center py-8 rounded-2xl bg-card border border-border/50">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">{t("assets.noNFT", locale)}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{t("assets.noNFTDesc", locale)}</p>
            <button onClick={() => switchTab("discover")} className="mt-3 rounded-lg bg-[var(--ogbo-blue)] px-4 py-1.5 text-xs text-white font-medium hover:bg-[var(--ogbo-blue-hover)] transition-colors">
              {t("assets.goDiscover", locale)}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 lg:gap-3">
            {wallet.nfts.map((nft, i) => (
              <motion.button
                key={nft.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedNFT(nft)}
                className="rounded-xl overflow-hidden bg-card border border-border/50 shadow-card"
              >
                <div className="aspect-square flex items-center justify-center text-3xl" style={{ backgroundColor: nft.color + "15" }}>
                  <span style={{ color: nft.color }} className="font-bold text-sm">NFT</span>
                </div>
                <div className="p-2">
                  <p className="text-[10px] font-medium truncate">{nft.name}</p>
                  <p className="text-[9px] text-muted-foreground">{nft.collection}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="mt-6 lg:mt-8 mx-4 lg:mx-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm lg:text-base font-semibold">{t("assets.recentTx", locale)}</h3>
          <button className="text-xs text-muted-foreground hover:text-[var(--ogbo-blue)] flex items-center transition-colors">
            {t("home.viewAll", locale)}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {wallet.transactions.map((tx, i) => {
            const typeLabel = tx.type === "send" ? (locale === "zh" ? "发送" : "Send") : tx.type === "receive" ? (locale === "zh" ? "接收" : "Receive") : (locale === "zh" ? "兑换" : "Swap");
            return (
              <motion.button
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedTx(tx)}
                className="w-full flex items-center gap-3 rounded-xl bg-card p-3 shadow-card border border-border/50 text-left group"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  tx.type === "send" ? "bg-red-50 dark:bg-red-950/30" : tx.type === "receive" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30"
                }`}>
                  <TxIcon type={tx.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{typeLabel}</span>
                    <span className={`text-sm font-semibold ${tx.amount < 0 ? "text-[var(--ogbo-red)]" : "text-[var(--ogbo-green)]"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} {tx.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground truncate pr-2">
                      {tx.to ? `${locale === "zh" ? "至" : "To"} ${tx.to}` : tx.from ? `${locale === "zh" ? "来自" : "From"} ${tx.from}` : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTimeAgo(tx.timestamp, locale)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Wallet Management */}
      <div className="mt-6 lg:mt-8 mx-4 lg:mx-6 mb-4">
        <h3 className="text-sm lg:text-base font-semibold mb-3">{t("assets.myWallets", locale)}</h3>
        <div className="space-y-2">
          {wallets.map((w) => (
            <motion.button
              key={w.id}
              whileTap={{ scale: 0.99 }}
              onClick={() => { switchWallet(w.id); toast.success(`${t("common.switchedTo", locale)} ${w.name}`); }}
              className={`w-full flex items-center gap-3 rounded-xl p-3 border text-left transition-all ${
                w.id === currentWalletId ? "bg-[var(--ogbo-blue)]/5 border-[var(--ogbo-blue)]/20" : "bg-card border-border/50 shadow-card hover:shadow-card-hover"
              }`}
            >
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{w.name}</span>
                  {w.id === currentWalletId && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--ogbo-blue)] text-white font-medium">{t("assets.current", locale)}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">{w.address.slice(0, 10)}...{w.address.slice(-6)}</p>
              </div>
              <span className="text-sm font-semibold text-muted-foreground">
                {isBalanceVisible ? `¥${w.balance.cny.toLocaleString()}` : "¥****"}
              </span>
            </motion.button>
          ))}
        </div>
        <div className="flex gap-3 mt-3">
          <button onClick={() => toast(t("common.comingSoon", locale))} className="flex-1 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> {t("assets.importWallet", locale)}
          </button>
          <button onClick={() => toast(t("common.comingSoon", locale))} className="flex-1 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> {t("assets.createWallet", locale)}
          </button>
        </div>
      </div>

      <TxDetailModal open={!!selectedTx} onClose={() => setSelectedTx(null)} tx={selectedTx} locale={locale} />
      <NFTDetailModal open={!!selectedNFT} onClose={() => setSelectedNFT(null)} nft={selectedNFT} locale={locale} />
    </div>
  );
}
