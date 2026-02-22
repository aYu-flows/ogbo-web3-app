"use client";

import React from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import toast, { Toaster } from "react-hot-toast";
import { useStore, type Locale } from "@/lib/store";
import { t } from "@/lib/i18n";
import AppDownloadBanner from "@/components/AppDownloadBanner";
import { useConnect, useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import {
  generateEVMWallet,
  walletFromMnemonic,
  walletFromPrivateKey,
  encryptWallet,
  decryptWallet,
  saveWallet,
  getStoredWallets,
  getActiveWallet,
  setActiveWalletId,
  generateWalletName,
  storeSessionKey,
  clearAllWallets,
  isValidMnemonic as ethersIsValidMnemonic,
  migrateKeystoreScrypt,
} from "@/lib/walletCrypto";
import {
  ArrowLeft, Eye, EyeOff, Lock, Globe, ChevronDown,
  Check, X, AlertCircle, AlertTriangle, Loader2,
  Copy, Shield, ChevronRight, Key, FileText,
  Fingerprint, RotateCcw, CheckCircle, Dices, Rocket, Clipboard,
  HelpCircle, Info, ExternalLink, Lightbulb, Wallet, Download,
} from "lucide-react";

// ======== Types ========
type AuthView =
  | "welcome"
  | "password-login"
  | "login"
  | "create-network"
  | "create-password"
  | "create-generate"
  | "create-verify"
  | "create-complete"
  | "import-select"
  | "import-mnemonic"
  | "import-privatekey"
  | "import-network"
  | "import-password"
  | "import-confirm-password";

// ======== Blockchain Network Data ========
interface BlockchainNetwork {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  color: string;
  gradient: string;
  descKey: string;
  features: { zh: string; en: string }[];
  addressPrefix: string;
  explorerUrl: string;
  isEVM: boolean;
  isRecommended?: boolean;
}

const SUPPORTED_NETWORKS: BlockchainNetwork[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    icon: "\u27E0",
    color: "#627EEA",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    descKey: "network.ethDesc",
    features: [
      { zh: "DeFi", en: "DeFi" },
      { zh: "NFT", en: "NFT" },
      { zh: "DAO", en: "DAO" },
    ],
    addressPrefix: "0x",
    explorerUrl: "https://etherscan.io",
    isEVM: true,
    isRecommended: true,
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    symbol: "BNB",
    icon: "\u25C7",
    color: "#F3BA2F",
    gradient: "linear-gradient(135deg, #F3BA2F 0%, #FCD535 100%)",
    descKey: "network.bscDesc",
    features: [
      { zh: "\u4F4EGas\u8D39", en: "Low Gas" },
      { zh: "\u5FEB\u901F\u4EA4\u6613", en: "Fast TX" },
      { zh: "DeFi", en: "DeFi" },
    ],
    addressPrefix: "0x",
    explorerUrl: "https://bscscan.com",
    isEVM: true,
    isRecommended: true,
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    icon: "\u2B21",
    color: "#8247E5",
    gradient: "linear-gradient(135deg, #8247E5 0%, #A855F7 100%)",
    descKey: "network.polygonDesc",
    features: [
      { zh: "\u4F4E\u8D39\u7528", en: "Low Fees" },
      { zh: "\u9AD8\u901F\u5EA6", en: "High Speed" },
      { zh: "\u517C\u5BB9\u4EE5\u592A\u574A", en: "ETH Compatible" },
    ],
    addressPrefix: "0x",
    explorerUrl: "https://polygonscan.com",
    isEVM: true,
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    icon: "\u25CE",
    color: "#14F195",
    gradient: "linear-gradient(135deg, #00FFA3 0%, #DC1FFF 100%)",
    descKey: "network.solanaDesc",
    features: [
      { zh: "\u8D85\u5FEB\u901F\u5EA6", en: "Ultra Fast" },
      { zh: "NFT", en: "NFT" },
      { zh: "\u6E38\u620F", en: "Gaming" },
    ],
    addressPrefix: "",
    explorerUrl: "https://explorer.solana.com",
    isEVM: false,
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    icon: "\u20BF",
    color: "#F7931A",
    gradient: "linear-gradient(135deg, #F7931A 0%, #FFA500 100%)",
    descKey: "network.btcDesc",
    features: [
      { zh: "\u4EF7\u503C\u5B58\u50A8", en: "Store of Value" },
      { zh: "\u53BB\u4E2D\u5FC3\u5316", en: "Decentralized" },
      { zh: "\u5B89\u5168", en: "Secure" },
    ],
    addressPrefix: "1/3/bc1",
    explorerUrl: "https://blockchair.com/bitcoin",
    isEVM: false,
  },
];

// ======== BIP39 Sample words for import validation hint ========
const BIP39_SAMPLE = [
  "abandon", "ability", "able", "about", "above", "absent",
  "absorb", "abstract", "absurd", "abuse", "access", "accident",
  "account", "accuse", "achieve", "acid", "acoustic", "acquire",
  "across", "act", "action", "actor", "actress", "actual",
  "adapt", "add", "addict", "address", "adjust", "admit",
  "adult", "advance", "advice", "aerobic", "affair", "afford",
  "afraid", "again", "age", "agent", "agree", "ahead",
  "aim", "air", "airport", "aisle", "alarm", "album",
  "alcohol", "alert", "alien", "all", "alley", "allow",
  "almost", "alone", "alpha", "already", "also", "alter",
  "always", "amateur", "amazing", "among", "amount", "amused",
  "analyst", "anchor", "ancient", "anger", "angle", "angry",
  "animal", "ankle", "announce", "annual", "another", "answer",
  "biology", "crystal", "deposit", "elephant", "fantasy",
  "galaxy", "harvest", "island", "jungle", "kingdom", "lightning",
];

// ======== Helpers ========
function getPasswordStrength(pw: string): "weak" | "medium" | "strong" {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

function formatNetworkAddress(addr: string, network: BlockchainNetwork) {
  if (network.isEVM) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  if (network.id === "solana") return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  if (network.id === "bitcoin") return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  return addr;
}

// ======== Page Transition Variants ========
const slideRight = {
  initial: { x: 300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -300, opacity: 0 },
};
const slideLeft = {
  initial: { x: -300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 300, opacity: 0 },
};

// ======== Language Switcher ========
function LangSwitcher() {
  const { locale, switchLocale } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted"
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm">{locale === "zh" ? "\u4E2D\u6587" : "EN"}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden"
            >
              <button
                onClick={() => { if (locale !== "zh") { switchLocale(); toast.success("\u8BED\u8A00\u5DF2\u5207\u6362"); } setOpen(false); }}
                className={`w-full px-3 py-2.5 text-sm text-left flex items-center justify-between hover:bg-muted transition-colors ${locale === "zh" ? "text-[var(--ogbo-blue)] font-semibold" : "text-foreground"}`}
              >
                <span>{"\u4E2D\u6587"}</span>
                {locale === "zh" && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { if (locale !== "en") { switchLocale(); toast.success("Language changed"); } setOpen(false); }}
                className={`w-full px-3 py-2.5 text-sm text-left flex items-center justify-between hover:bg-muted transition-colors ${locale === "en" ? "text-[var(--ogbo-blue)] font-semibold" : "text-foreground"}`}
              >
                <span>English</span>
                {locale === "en" && <Check className="w-4 h-4" />}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ======== Progress Bar ========
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1 rounded-full"
          initial={{ width: 32, backgroundColor: "hsl(var(--border))" }}
          animate={{ backgroundColor: i < step ? "var(--ogbo-blue)" : "hsl(var(--border))" }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          style={{ width: 32 }}
        />
      ))}
    </div>
  );
}

// ======== Back Header ========
function BackHeader({ onBack, rightSlot }: { onBack: () => void; rightSlot?: React.ReactNode }) {
  const { locale } = useStore();
  return (
    <div className="flex items-center justify-between h-14 px-4 lg:px-6" style={{ paddingTop: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 8px)' }}>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors rounded-full p-1 hover:bg-muted"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm">{t("common.back", locale)}</span>
      </button>
      {rightSlot}
    </div>
  );
}

// ======== Password Input ========
function PasswordInput({
  value, onChange, placeholder, error, autoFocus, id,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  error?: boolean; autoFocus?: boolean; id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <motion.div
      animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
      transition={{ duration: 0.4 }}
      className="relative"
    >
      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`w-full h-12 pl-12 pr-12 border-2 rounded-xl text-base font-sans transition-all outline-none
          ${error
            ? "border-[var(--ogbo-red)] bg-red-50 dark:bg-red-950/20 focus:ring-2 focus:ring-red-500/20"
            : "border-border bg-card focus:border-[var(--ogbo-blue)] focus:ring-2 focus:ring-[var(--ogbo-blue)]/20"
          }`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </motion.div>
  );
}

// ======== Network Indicator (small pill) ========
function NetworkIndicator({ network, onSwitch }: { network: BlockchainNetwork; onSwitch?: () => void }) {
  return (
    <button
      onClick={onSwitch}
      className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full hover:bg-accent transition-colors"
    >
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white"
        style={{ background: network.gradient }}
      >
        {network.icon}
      </div>
      <span className="text-xs font-semibold">{network.symbol}</span>
      {onSwitch && <ChevronDown className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ======== Network Guide Modal ========
function NetworkGuideModal({ open, onClose, locale }: { open: boolean; onClose: () => void; locale: Locale }) {
  if (!open) return null;
  const steps = [
    { color: "bg-blue-100 dark:bg-blue-950/50", textColor: "text-blue-600", title: t("network.forBeginners", locale), desc: t("network.forBeginnersDesc", locale) },
    { color: "bg-purple-100 dark:bg-purple-950/50", textColor: "text-purple-600", title: t("network.saveGas", locale), desc: t("network.saveGasDesc", locale) },
    { color: "bg-green-100 dark:bg-green-950/50", textColor: "text-green-600", title: t("network.nftGaming", locale), desc: t("network.nftGamingDesc", locale) },
    { color: "bg-orange-100 dark:bg-orange-950/50", textColor: "text-orange-600", title: t("network.longTermHold", locale), desc: t("network.longTermHoldDesc", locale) },
  ];
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border"
        >
          <h3 className="text-xl font-bold mb-5">{t("network.howToChoose", locale)}</h3>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className={`w-8 h-8 ${step.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className={`${step.textColor} font-bold text-sm`}>{i + 1}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-0.5">{step.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 mt-5 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              <Lightbulb className="w-3 h-3 inline mr-1" />
              {t("network.switchTip", locale)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-5 h-10 rounded-xl bg-[var(--ogbo-blue)] text-white font-semibold hover:bg-[var(--ogbo-blue-hover)] transition-colors text-sm"
          >
            {t("network.gotIt", locale)}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ======== Network Switcher BottomSheet ========
function NetworkSwitcherSheet({
  open, onClose, selectedNetwork, onSelect, locale,
}: {
  open: boolean; onClose: () => void;
  selectedNetwork: BlockchainNetwork;
  onSelect: (n: BlockchainNetwork) => void;
  locale: Locale;
}) {
  if (!open) return null;
  return (
    <AnimatePresence>
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
          className="relative w-full max-w-lg rounded-t-2xl lg:rounded-2xl bg-card p-5 text-card-foreground"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted lg:hidden" />
          <h3 className="text-lg font-bold mb-4">{t("network.switchNetwork", locale)}</h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {SUPPORTED_NETWORKS.map((network) => (
              <button
                key={network.id}
                onClick={() => {
                  onSelect(network);
                  onClose();
                  toast.success(`${t("network.switchedTo", locale)} ${network.name}`);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedNetwork.id === network.id
                    ? "border-[var(--ogbo-blue)] bg-blue-50 dark:bg-blue-950/20"
                    : "border-border hover:border-muted-foreground hover:bg-muted"
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white"
                  style={{ background: network.gradient }}
                >
                  {network.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{network.name}</span>
                    {network.isRecommended && (
                      <span className="text-[10px] text-orange-600 font-semibold">{t("network.recommended", locale)}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{t(network.descKey, locale)}</span>
                </div>
                {selectedNetwork.id === network.id && <Check className="w-5 h-5 text-[var(--ogbo-blue)]" />}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ========================================
// 1) WELCOME VIEW
// ========================================
function WelcomeView({ goTo }: { goTo: (v: AuthView) => void }) {
  const { locale } = useStore();
  const [isBrowser, setIsBrowser] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsBrowser(!(window as any).Capacitor);
      setHasWallet(getStoredWallets().filter((w) => w.type !== 'external' && !!w.keystore).length > 0);
    }
  }, []);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = "https://github.com/aYu-flows/ogbo-web3-app/releases/download/v1.0/OGBOX-v1.0.apk";
    link.download = "OGBOX-v1.0.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6" style={{ paddingTop: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 8px)' }}>
        {/* Download button — left side, browser only */}
        {isBrowser ? (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.25, ease: "easeOut" }}
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ogbo-blue)] hover:bg-[var(--ogbo-blue-hover)] text-white rounded-xl text-xs font-semibold shadow-lg transition-colors"
            aria-label={locale === "zh" ? "下载 OGBOX App" : "Download OGBOX App"}
          >
            <Download className="w-3.5 h-3.5" />
            {locale === "zh" ? "下载 APP" : "Get App"}
          </motion.button>
        ) : <div />}
        {/* Language switcher — right side */}
        <LangSwitcher />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
          className="w-28 h-28 lg:w-32 lg:h-32 relative mb-8"
        >
          <Image
            src="/logo/logo.png"
            alt="OGBOX Logo"
            width={128}
            height={128}
            className="object-contain drop-shadow-2xl"
          />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-3xl lg:text-4xl font-bold text-foreground text-center text-balance">
          {t("auth.welcomeTo", locale)} OGBOX
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="text-base lg:text-lg text-muted-foreground mt-2 text-center">
          {t("auth.secureWallet", locale)}
        </motion.p>
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="px-6 lg:px-8 pb-8 lg:pb-10 space-y-3 lg:max-w-md lg:mx-auto lg:w-full">
        <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
          onClick={() => goTo("create-network")}
          className="w-full h-12 lg:h-14 bg-[var(--ogbo-blue)] hover:bg-[var(--ogbo-blue-hover)] active:bg-[var(--ogbo-blue-active)] text-white rounded-xl font-semibold shadow-md flex items-center justify-center gap-2 transition-colors text-base">
          {t("auth.createWallet", locale)}
        </motion.button>
        {/* 密码登录：仅在本地有存储钱包时显示 */}
        {hasWallet && (
          <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
            onClick={() => goTo("password-login")}
            className="w-full h-12 lg:h-14 bg-muted hover:bg-accent border border-border text-foreground rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-base">
            <Lock className="w-5 h-5" />
            <span>{locale === "zh" ? "密码登录" : "Password Login"}</span>
          </motion.button>
        )}
        <motion.button whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
          onClick={() => goTo("import-select")}
          className="w-full h-12 lg:h-14 bg-muted hover:bg-accent text-[var(--ogbo-blue)] border border-border rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors text-base">
          {t("auth.importWallet", locale)}
        </motion.button>
        <button onClick={() => goTo("login")}
          className="w-full text-center text-[var(--ogbo-blue)] text-sm font-medium hover:text-[var(--ogbo-blue-hover)] underline underline-offset-2 py-2 transition-colors">
          {t("auth.hasWalletLogin", locale)}
        </button>
      </motion.div>
    </div>
  );
}

// ========================================
// 2) LOGIN VIEW — 通过钱包App登录（精简版，仅展示4个固定钱包按钮）
// ========================================

// 四个支持的钱包（固定顺序：OKX、Token Pocket、MetaMask、Binance）
const FEATURED_WALLETS = [
  {
    id: "okx",
    name: "OKX Wallet",
    wcId: "971e689d0a5be527bac79dbb1d59ffa3f290fbe6cb2fb928c0c32d5a28a3b7b3",
    iconUrl: "https://registry.walletconnect.com/v2/logo/md/971e689d0a5be527bac79dbb1d59ffa3f290fbe6cb2fb928c0c32d5a28a3b7b3",
    fallbackColor: "#000000",
    fallbackInitial: "O",
  },
  {
    id: "tokenpocket",
    name: "Token Pocket",
    wcId: "20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66",
    iconUrl: "https://registry.walletconnect.com/v2/logo/md/20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66",
    fallbackColor: "#2980FE",
    fallbackInitial: "T",
  },
  {
    id: "metamask",
    name: "MetaMask",
    wcId: "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    iconUrl: "https://registry.walletconnect.com/v2/logo/md/c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96",
    fallbackColor: "#E8831D",
    fallbackInitial: "M",
  },
  {
    id: "binance",
    name: "Binance Wallet",
    wcId: "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4",
    iconUrl: "https://registry.walletconnect.com/v2/logo/md/8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4",
    fallbackColor: "#F3BA2F",
    fallbackInitial: "B",
  },
] as const;

function WalletConnectButton({
  wallet, onConnect,
}: {
  wallet: typeof FEATURED_WALLETS[number];
  onConnect: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onConnect}
      className="w-full h-12 rounded-xl border border-border bg-card hover:bg-muted flex items-center gap-3 px-4 transition-colors"
    >
      {!imgError ? (
        <img
          src={wallet.iconUrl}
          alt={wallet.name}
          className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: wallet.fallbackColor }}
        >
          {wallet.fallbackInitial}
        </div>
      )}
      <span className="text-sm font-medium flex-1 text-left">{wallet.name}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </motion.button>
  );
}

function LoginView({ goTo, onSuccess }: { goTo: (v: AuthView) => void; onSuccess: (address?: string) => void }) {
  const { locale } = useStore();
  const { address, isConnected } = useAccount();
  const { open: openAppKit } = useAppKit();
  const userInitiatedConnect = useRef(false);
  const hasTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Proceed to app as soon as wallet connects — no pre-initialization needed
  useEffect(() => {
    if (!isConnected || !address || !userInitiatedConnect.current || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;
    userInitiatedConnect.current = false;
    if (!isMountedRef.current) return;
    toast.success(t("wallet.connected", locale));
    setTimeout(() => { if (isMountedRef.current) onSuccess(address); }, 300);
  }, [isConnected, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = () => {
    userInitiatedConnect.current = true;
    hasTriggeredRef.current = false; // allow re-trigger if user retries
    openAppKit();
  };

  return (
    <div className="flex flex-col h-full relative">
      <BackHeader onBack={() => goTo("welcome")} />
      <div className="flex-1 flex flex-col items-center px-6 lg:px-8 lg:max-w-md lg:mx-auto lg:w-full">
        <div className="mt-8 lg:mt-16 mb-6 flex justify-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Wallet className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ogbo-blue)]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1 text-center">
          {locale === "zh" ? "通过钱包App登录" : "Login with Wallet App"}
        </h2>
        <p className="text-sm text-muted-foreground mb-8 text-center">
          {locale === "zh" ? "选择你的钱包应用以连接" : "Select your wallet app to connect"}
        </p>

        <div className="w-full space-y-2.5">
          {FEATURED_WALLETS.map((wallet) => (
            <WalletConnectButton key={wallet.id} wallet={wallet} onConnect={handleConnect} />
          ))}
          {/* 扫码 / 更多钱包 */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConnect}
            className="w-full h-11 rounded-xl border border-dashed border-[var(--ogbo-blue)] bg-[var(--ogbo-blue)]/5 hover:bg-[var(--ogbo-blue)]/10 flex items-center gap-3 px-4 transition-colors"
          >
            <Wallet className="w-5 h-5 text-[var(--ogbo-blue)]" />
            <span className="text-sm font-medium flex-1 text-left text-[var(--ogbo-blue)]">
              {locale === "zh" ? "扫码 / 更多钱包" : "Scan QR / More Wallets"}
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--ogbo-blue)]" />
          </motion.button>
        </div>
      </div>

    </div>
  );
}

// ========================================
// 2-A) PASSWORD LOGIN VIEW（密码解锁）
// ========================================
function PasswordLoginView({ goTo, onSuccess }: {
  goTo: (v: AuthView) => void;
  onSuccess: (address?: string) => void;
}) {
  const { locale } = useStore();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const activeWallet = getActiveWallet();
  const isLocked = lockUntil > now;
  const lockSecondsLeft = Math.ceil((lockUntil - now) / 1000);

  // 锁定期间每秒刷新 now，保持倒计时实时更新
  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  // 防卫性跳转（若无钱包数据）
  useEffect(() => {
    if (!getActiveWallet()) goTo("welcome");
  }, [goTo]);

  const handleUnlock = async () => {
    if (!password || !activeWallet || isLocked) return;
    setLoading(true);
    setError(false);
    try {
      const wallet = await decryptWallet(activeWallet.keystore, password);
      storeSessionKey(wallet.privateKey);
      setRetryCount(0);
      toast.success(t("auth.loginSuccess", locale));
      // 异步后台迁移旧 keystore 到轻量 scrypt（不阻塞登录）
      migrateKeystoreScrypt(password).catch(() => {});
      setTimeout(() => onSuccess(wallet.address), 300);
    } catch {
      const newCount = retryCount + 1;
      setRetryCount(newCount);
      setError(true);
      toast.error(t("auth.incorrectPassword", locale));
      setPassword("");
      if (newCount >= 5) {
        setLockUntil(Date.now() + 60_000);
        setRetryCount(0);
        toast.error(locale === "zh" ? "密码错误次数过多，请等待 60 秒后重试" : "Too many attempts. Wait 60 seconds.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("welcome")} />
      <div className="flex-1 flex flex-col items-center px-6 lg:px-8 lg:max-w-md lg:mx-auto lg:w-full">
        <div className="mt-8 lg:mt-16 mb-6">
          <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5 }}>
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Lock className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ogbo-blue)]" />
            </div>
          </motion.div>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1">{t("auth.enterPassword", locale)}</h2>
        <p className="text-sm text-muted-foreground mb-8">{t("auth.enterWalletPassword", locale)}</p>
        <div className="w-full space-y-3">
          <PasswordInput
            value={password}
            onChange={(v) => { setPassword(v); setError(false); }}
            placeholder={t("auth.enterPassword", locale)}
            error={error}
            autoFocus
          />
          {error && !isLocked && (
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
              className="text-[var(--ogbo-red)] text-sm flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              <span>
                {t("auth.incorrectPassword", locale)}
                {retryCount > 2 && ` (${5 - retryCount} ${locale === "zh" ? "次剩余" : " left"})`}
              </span>
            </motion.p>
          )}
          {isLocked && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-[var(--ogbo-orange)] text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              <span>{locale === "zh" ? `已锁定，${lockSecondsLeft} 秒后可重试` : `Locked. Retry in ${lockSecondsLeft}s`}</span>
            </motion.p>
          )}
        </div>
        <button
          onClick={() => setShowResetDialog(true)}
          className="mt-3 text-sm text-[var(--ogbo-blue)] hover:text-[var(--ogbo-blue-hover)] transition-colors"
        >
          {t("auth.forgotPassword", locale)}
        </button>
        <div className="w-full mt-8">
          <motion.button
            whileHover={password.length > 0 && !isLocked ? { scale: 1.02 } : {}}
            whileTap={password.length > 0 && !isLocked ? { scale: 0.98 } : {}}
            disabled={loading || password.length === 0 || isLocked}
            onClick={handleUnlock}
            className={`w-full h-12 lg:h-14 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-base ${
              password.length > 0 && !isLocked
                ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{t("auth.unlocking", locale)}</span></>
              : <span>{t("auth.unlockWallet", locale)}</span>}
          </motion.button>
        </div>
      </div>

      {/* 忘记密码对话框 */}
      <AnimatePresence>
        {showResetDialog && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowResetDialog(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-border">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-[var(--ogbo-orange)]" />
                </div>
                <h3 className="text-lg font-bold mb-2">{t("auth.resetTitle", locale)}</h3>
                <p className="text-sm text-muted-foreground mb-1">{t("auth.resetDesc", locale)}</p>
                <p className="text-sm text-[var(--ogbo-red)] font-medium mb-6">{t("auth.resetWarning", locale)}</p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setShowResetDialog(false)}
                    className="flex-1 h-10 rounded-xl bg-muted hover:bg-accent text-foreground font-medium transition-colors text-sm">
                    {t("common.cancel", locale)}
                  </button>
                  <button
                    onClick={() => {
                      setShowResetDialog(false);
                      clearAllWallets();
                      sessionStorage.removeItem("ogbo_session_pk");
                      goTo("welcome");
                    }}
                    className="flex-1 h-10 rounded-xl bg-[var(--ogbo-blue)] text-white font-medium hover:bg-[var(--ogbo-blue-hover)] transition-colors text-sm">
                    {t("auth.goImport", locale)}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ========================================
// NETWORK SELECTION VIEW (shared for create & import)
// ========================================
function NetworkSelectionView({ goTo, nextView, backView, descKey, onSelectNetwork }: {
  goTo: (v: AuthView) => void;
  nextView: AuthView;
  backView: AuthView;
  descKey: string;
  onSelectNetwork: (n: BlockchainNetwork) => void;
}) {
  const { locale } = useStore();
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (network: BlockchainNetwork) => {
    // Solana / Bitcoin: Coming Soon
    if (!network.isEVM) {
      const msg = network.id === "solana"
        ? (locale === "zh" ? "Solana 支持即将推出 🔜" : "Solana support coming soon 🔜")
        : (locale === "zh" ? "Bitcoin 支持即将推出 🔜" : "Bitcoin support coming soon 🔜");
      toast(msg, { duration: 2500 });
      return;
    }
    setSelectedId(network.id);
    onSelectNetwork(network);
    toast.success(`${t("network.selected", locale)} ${network.name}`, { duration: 1500 });
    setTimeout(() => goTo(nextView), 400);
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader
        onBack={() => goTo(backView)}
        rightSlot={
          <button onClick={() => setShowGuide(true)} className="p-2 hover:bg-muted rounded-full transition-colors">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-8 lg:max-w-2xl lg:mx-auto lg:w-full">
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-2xl lg:text-3xl font-bold mt-4 lg:mt-8 text-center">
          {t("network.chooseChain", locale)}
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="text-sm text-muted-foreground mt-1 mb-6 text-center">
          {t(descKey, locale)}
        </motion.p>

        {/* Network Cards */}
        <div className="space-y-3 lg:space-y-4">
          {SUPPORTED_NETWORKS.map((network, index) => (
            <motion.div
              key={network.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
            >
              <motion.button
                whileHover={{ scale: 1.01, y: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSelect(network)}
                className={`relative w-full bg-card rounded-2xl p-4 lg:p-5 border-2 text-left shadow-sm hover:shadow-lg transition-all overflow-hidden group ${
                  selectedId === network.id
                    ? "border-[var(--ogbo-blue)] ring-2 ring-[var(--ogbo-blue)]/20"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                {/* Hover gradient overlay */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity pointer-events-none" style={{ background: network.gradient }} />

                {/* Recommended / Coming Soon badge */}
                {network.isRecommended && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 bg-gradient-to-r from-orange-400 to-pink-500 text-white text-[10px] font-semibold rounded-full shadow-sm">
                      {t("network.recommended", locale)}
                    </span>
                  </div>
                )}
                {!network.isEVM && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-semibold rounded-full border border-border">
                      {locale === "zh" ? "即将支持" : "Coming Soon"}
                    </span>
                  </div>
                )}

                <div className="relative flex items-start gap-3 lg:gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl text-white shadow-md flex-shrink-0" style={{ background: network.gradient }}>
                    {network.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base lg:text-lg font-bold">{network.name}</h3>
                      <span className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded" style={{ background: `${network.color}20`, color: network.color }}>
                        {network.symbol}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{t(network.descKey, locale)}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {network.features.map((f, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground rounded-md font-medium">
                          {locale === "zh" ? f.zh : f.en}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all" style={{ color: network.color }}>
                      <span>{t("network.select", locale)}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Hover border glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ boxShadow: `0 0 0 2px ${network.color}40` }} />
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Bottom tip */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Lightbulb className="w-4 h-4" />
          <span>{t("network.addLaterTip", locale)}</span>
        </motion.div>
      </div>

      <NetworkGuideModal open={showGuide} onClose={() => setShowGuide(false)} locale={locale} />
    </div>
  );
}

// ========================================
// 3) CREATE WALLET - SET PASSWORD
// ========================================
function CreatePasswordView({ goTo, network, onSwitchNetwork, onPasswordSet }: {
  goTo: (v: AuthView) => void; network: BlockchainNetwork;
  onSwitchNetwork: () => void;
  onPasswordSet: (password: string) => void;
}) {
  const { locale } = useStore();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const strength = getPasswordStrength(pw);
  const checks = useMemo(() => ({ min8: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), num: /[0-9]/.test(pw) }), [pw]);
  const isMatch = confirmPw.length === 0 || pw === confirmPw;
  const canProceed = checks.min8 && checks.upper && checks.lower && checks.num && pw === confirmPw && confirmPw.length > 0;
  const strengthColor = strength === "weak" ? "var(--ogbo-red)" : strength === "medium" ? "var(--ogbo-orange)" : "var(--ogbo-green)";
  const strengthLabel = t(`create.strength${strength.charAt(0).toUpperCase() + strength.slice(1)}`, locale);

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("create-network")} rightSlot={
        <div className="flex items-center gap-2">
          <NetworkIndicator network={network} onSwitch={onSwitchNetwork} />
          <ProgressBar step={1} total={4} />
        </div>
      } />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-md lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("create.setPassword", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("create.protectWallet", locale)}</p>
        <label htmlFor="create-pw" className="text-sm font-medium text-foreground mb-2 block">{t("auth.enterPassword", locale)}</label>
        <PasswordInput id="create-pw" value={pw} onChange={setPw} placeholder={t("create.passwordMin8", locale)} autoFocus />
        {pw.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("create.passwordStrength", locale)}:</span>
              <div className="flex gap-1 flex-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-1 rounded-full flex-1" animate={{ backgroundColor: (i === 0) ? strengthColor : (i === 1 && strength !== "weak") ? strengthColor : (i === 2 && strength === "strong") ? strengthColor : "hsl(var(--border))" }} transition={{ duration: 0.2 }} />
                ))}
              </div>
              <span className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
          </motion.div>
        )}
        <div className="mt-4 space-y-2">
          {([
            { key: "min8", label: t("create.atLeast8Chars", locale), met: checks.min8 },
            { key: "upper", label: t("create.includeUppercase", locale), met: checks.upper },
            { key: "lower", label: t("create.includeLowercase", locale), met: checks.lower },
            { key: "num", label: t("create.includeNumber", locale), met: checks.num },
          ] as const).map((item) => (
            <motion.div key={item.key} className="flex items-center gap-2 text-sm" animate={{ color: item.met ? "var(--ogbo-green)" : undefined }}>
              {item.met ? (<motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: "spring" }}><Check className="w-4 h-4 text-[var(--ogbo-green)]" /></motion.div>) : (<X className="w-4 h-4 text-muted-foreground" />)}
              <span className={item.met ? "text-[var(--ogbo-green)]" : "text-muted-foreground"}>{item.label}</span>
            </motion.div>
          ))}
        </div>
        <label htmlFor="confirm-pw" className="text-sm font-medium text-foreground mb-2 block mt-6">{t("create.confirmPassword", locale)}</label>
        <PasswordInput id="confirm-pw" value={confirmPw} onChange={setConfirmPw} placeholder={t("create.confirmPassword", locale)} error={!isMatch} />
        {!isMatch && confirmPw.length > 0 && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[var(--ogbo-red)] text-sm mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /><span>{t("create.passwordMismatch", locale)}</span>
          </motion.p>
        )}
        <motion.button whileHover={canProceed ? { scale: 1.02 } : {}} whileTap={canProceed ? { scale: 0.98 } : {}} disabled={!canProceed}
          onClick={() => { onPasswordSet(pw); goTo("create-generate"); }}
          className={`w-full h-12 lg:h-14 rounded-xl font-semibold mt-8 flex items-center justify-center gap-2 transition-all text-base ${canProceed ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
          <span>{t("create.next", locale)}</span><ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// 4) CREATE WALLET - GENERATE PHRASE
// ========================================
function CreateGenerateView({ goTo, network, onMnemonicGenerated, backView }: {
  goTo: (v: AuthView) => void;
  network: BlockchainNetwork;
  onMnemonicGenerated: (mnemonic: string) => void;
  backView: AuthView;
}) {
  const { locale } = useStore();
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 600));
    const { mnemonic: phraseStr } = generateEVMWallet();
    const words = phraseStr.split(" ");
    setMnemonic(words);
    onMnemonicGenerated(phraseStr); // 上传真实助记词给 LoginApp
    setGenerating(false);
  };

  const handleCopy = async () => {
    // 带序号格式：便于用户抄写辨认
    const copyText = mnemonic.map((w, i) => `${i + 1}. ${w}`).join("\n");
    try {
      const isCapacitor = !!(window as any).Capacitor;
      if (isCapacitor) {
        const { Clipboard: CapClipboard } = await import('@capacitor/clipboard');
        await CapClipboard.write({ string: copyText });
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = copyText;
        ta.style.cssText = "position:fixed;opacity:0;top:-9999px;left:-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand failed");
      }
      setCopied(true);
      toast.success(t("create.phraseCopied", locale));
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error(locale === "zh" ? "复制失败，请手动抄写" : "Copy failed, please write it down manually");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo(backView)} rightSlot={
        <div className="flex items-center gap-2">
          <NetworkIndicator network={network} />
          <ProgressBar step={2} total={4} />
        </div>
      } />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-lg lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("create.generatePhrase", locale)}</h2>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mt-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--ogbo-orange)] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-semibold text-orange-900 dark:text-orange-200 text-sm">{t("create.importantNotice", locale)}</h3>
              <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed">{t("create.phraseOnlyWay", locale)}{"  "}{t("create.keepSafe", locale)}</p>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {mnemonic.length === 0 ? (
            <motion.div key="generate-btn" exit={{ opacity: 0, scale: 0.9 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGenerate} disabled={generating}
                className="w-full mt-6 h-36 lg:h-40 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[var(--ogbo-blue)] hover:bg-blue-50 dark:hover:bg-blue-950/10 transition-all">
                {generating ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: 3 }}><Dices className="w-12 h-12 text-[var(--ogbo-blue)]" /></motion.div>
                  <span className="text-muted-foreground font-semibold">{t("create.generating", locale)}</span></>
                ) : (
                  <><Dices className="w-12 h-12 text-muted-foreground" /><span className="text-muted-foreground font-semibold">{t("create.tapToGenerate", locale)}</span></>
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="mnemonic-grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-5 lg:p-6">
              <h3 className="text-base lg:text-lg font-semibold mb-4">{t("create.yourPhrase", locale)}</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                {mnemonic.map((word, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-lg p-2.5 lg:p-3 flex items-center gap-2 shadow-sm border border-border">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span className="font-mono font-semibold text-sm flex-1">{word}</span>
                  </motion.div>
                ))}
              </div>
              <button onClick={handleCopy}
                className="w-full mt-4 h-10 bg-card border border-border rounded-lg flex items-center justify-center gap-2 hover:bg-muted transition-colors">
                {copied ? (<><Check className="w-4 h-4 text-[var(--ogbo-green)]" /><span className="text-[var(--ogbo-green)] text-sm font-medium">{t("create.copied", locale)}</span></>) :
                (<><Copy className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground text-sm font-medium">{t("create.copyPhrase", locale)}</span></>)}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {mnemonic.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 mt-4">
              <Shield className="w-5 h-5 text-[var(--ogbo-orange)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">{t("create.writeOnPaper", locale)}</p>
            </div>
            <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => goTo("create-verify")}
              className="w-full h-12 lg:h-14 mt-6 bg-[var(--ogbo-blue)] text-white rounded-xl font-semibold shadow-md hover:bg-[var(--ogbo-blue-hover)] flex items-center justify-center gap-2 transition-colors text-base">
              <span>{t("create.writtenDown", locale)}</span><CheckCircle className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ========================================
// 5) CREATE WALLET - VERIFY PHRASE (简化版：仅验证第1词和第12词)
// ========================================
function CreateVerifyView({ goTo, network, mnemonic }: {
  goTo: (v: AuthView) => void;
  network: BlockchainNetwork;
  mnemonic: string;
}) {
  const { locale } = useStore();
  const [selectedWords, setSelectedWords] = useState<(string | null)[]>([null, null]);
  const [verifyResult, setVerifyResult] = useState<"" | "success" | "error">("");
  const [verifying, setVerifying] = useState(false);

  const mnemonicWords = useMemo(() => mnemonic.trim().split(/\s+/), [mnemonic]);

  // 防卫：助记词长度异常时提前返回
  if (mnemonicWords.length < 12) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6">
        <AlertCircle className="w-12 h-12 text-[var(--ogbo-red)] mb-4" />
        <p className="text-sm text-muted-foreground text-center">
          {locale === "zh" ? "助记词格式错误，请返回重新生成" : "Invalid phrase format, please go back and regenerate"}
        </p>
        <button onClick={() => goTo("create-generate")} className="mt-4 text-[var(--ogbo-blue)] text-sm font-medium">
          {t("common.back", locale)}
        </button>
      </div>
    );
  }

  // 各槽独立的 4 候选词（1 正确 + 3 随机干扰，基于索引防止重复词 bug）
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const slot0Candidates = useMemo(() => {
    const correct = { word: mnemonicWords[0], origIdx: 0 };
    const others = mnemonicWords
      .map((word, origIdx) => ({ word, origIdx }))
      .filter(item => item.origIdx !== 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...others, correct].sort(() => Math.random() - 0.5);
  }, [mnemonicWords]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const slot11Candidates = useMemo(() => {
    const correct = { word: mnemonicWords[11], origIdx: 11 };
    const others = mnemonicWords
      .map((word, origIdx) => ({ word, origIdx }))
      .filter(item => item.origIdx !== 11)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [...others, correct].sort(() => Math.random() - 0.5);
  }, [mnemonicWords]);

  const allSelected = selectedWords[0] !== null && selectedWords[1] !== null;

  const handleUnselectWord = (slotIdx: number) => {
    if (verifyResult) return;
    setSelectedWords(prev => {
      const next = [...prev] as (string | null)[];
      next[slotIdx] = null;
      return next;
    });
  };

  const handleVerify = async () => {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 500));
    const isCorrect = selectedWords[0] === mnemonicWords[0] && selectedWords[1] === mnemonicWords[11];
    if (isCorrect) {
      setVerifyResult("success");
      toast.success(t("create.verifySuccess", locale));
      setTimeout(() => goTo("create-complete"), 1500);
    } else {
      setVerifyResult("error");
      toast.error(t("create.verifyFailed", locale));
      setTimeout(() => {
        setVerifyResult("");
        setSelectedWords([null, null]);
      }, 2000);
    }
    setVerifying(false);
  };

  const slots = [
    { label: t("create.slot1Label", locale), slotIdx: 0, candidates: slot0Candidates },
    { label: t("create.slot12Label", locale), slotIdx: 1, candidates: slot11Candidates },
  ];

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("create-generate")} rightSlot={
        <div className="flex items-center gap-2">
          <NetworkIndicator network={network} />
          <ProgressBar step={3} total={4} />
        </div>
      } />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-lg lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("create.verifyPhrase", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{t("create.verifyOnlyFirstLast", locale)}</p>

        {/* 两个选择槽（并排） */}
        <div className="grid grid-cols-2 gap-4">
          {slots.map(({ label, slotIdx }) => (
            <motion.div
              key={slotIdx}
              className={`h-20 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 px-3 transition-all ${
                selectedWords[slotIdx]
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 cursor-pointer hover:border-blue-400"
                  : "bg-card border-dashed border-border"
              }`}
              onClick={() => selectedWords[slotIdx] && handleUnselectWord(slotIdx)}
              animate={
                verifyResult === "success"
                  ? { borderColor: "var(--ogbo-green)", backgroundColor: "rgba(16,185,129,0.12)" }
                  : verifyResult === "error"
                  ? { x: [-4, 4, -4, 4, 0], borderColor: "var(--ogbo-red)" }
                  : {}
              }
            >
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              {selectedWords[slotIdx]
                ? <span className="font-mono font-semibold text-sm text-blue-900 dark:text-blue-100">{selectedWords[slotIdx]}</span>
                : <span className="text-muted-foreground text-sm font-mono">____</span>}
              {selectedWords[slotIdx] && !verifyResult && (
                <X className="w-3 h-3 text-blue-400 opacity-60" />
              )}
            </motion.div>
          ))}
        </div>

        {/* 各槽独立候选词区域 */}
        {slots.map(({ label, slotIdx, candidates }) => (
          <div key={slotIdx} className={slotIdx === 0 ? "mt-5" : "mt-3"}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
            <div className="grid grid-cols-2 gap-2">
              {candidates.map(({ word, origIdx }) => (
                <button
                  key={origIdx}
                  disabled={selectedWords[slotIdx] !== null}
                  onClick={() => {
                    if (selectedWords[slotIdx] === null) {
                      setSelectedWords(prev => {
                        const next = [...prev] as (string | null)[];
                        next[slotIdx] = word;
                        return next;
                      });
                    }
                  }}
                  className={`h-10 rounded-lg border font-mono text-sm font-semibold transition-colors ${
                    selectedWords[slotIdx] !== null
                      ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                      : "bg-card border-border hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-[var(--ogbo-blue)]"
                  }`}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        ))}

        <motion.button
          whileHover={allSelected ? { scale: 1.02 } : {}} whileTap={allSelected ? { scale: 0.98 } : {}}
          disabled={!allSelected || verifying} onClick={handleVerify}
          className={`w-full h-12 lg:h-14 rounded-xl font-semibold mt-6 flex items-center justify-center gap-2 transition-all text-base ${allSelected ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
          {verifying ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>{t("create.verifying", locale)}</span></>) : (<><span>{t("create.verifyAndComplete", locale)}</span><CheckCircle className="w-5 h-5" /></>)}
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// 6) CREATE WALLET - COMPLETE (with network info)
// ========================================
function CreateCompleteView({
  onSuccess, network, mnemonic, password,
}: {
  onSuccess: (address?: string) => void;
  network: BlockchainNetwork;
  mnemonic: string;
  password: string; // "" when existing wallets present (password step was skipped)
}) {
  const { locale } = useStore();
  const [walletAddress, setWalletAddress] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [encryptError, setEncryptError] = useState("");
  const [addressCopied, setAddressCopied] = useState(false);
  const hasExecutedRef = useRef(false);

  // 有已存钱包 & password 为空时，先进入密码确认阶段（外部钱包不计入，无 keystore 无法验证密码）
  const needPasswordConfirm = password === "" && (typeof window !== "undefined" ? getStoredWallets().filter((w) => w.type !== 'external' && !!w.keystore).length > 0 : false);
  const [confirmingPassword, setConfirmingPassword] = useState(needPasswordConfirm);
  const [pendingPw, setPendingPw] = useState("");
  const [pwConfirmError, setPwConfirmError] = useState(false);
  const [pwConfirmLoading, setPwConfirmLoading] = useState(false);

  // 接受密码参数的 doCreateAndSave
  const doCreateAndSave = useCallback(async (pw: string) => {
    try {
      setEncrypting(true);
      setEncryptError("");
      const wallet = walletFromMnemonic(mnemonic);
      setWalletAddress(wallet.address);
      const keystore = await encryptWallet(wallet, pw);
      const savedWallet = saveWallet({
        name: generateWalletName(),
        network: network.id,
        address: wallet.address,
        keystore,
      });
      setActiveWalletId(savedWallet.id);
      storeSessionKey(wallet.privateKey);
      setEncrypting(false);
      setConfirmingPassword(false);
    } catch (e: any) {
      setEncryptError(e?.message || "创建钱包时出错，请重试");
      setEncrypting(false);
    }
  }, [mnemonic, network.id]);

  // 初始化：如不需要密码确认，直接开始加密
  useEffect(() => {
    if (needPasswordConfirm) return; // 等待用户确认密码
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;
    doCreateAndSave(password);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordConfirm = async () => {
    if (!pendingPw) return;
    const activeWallet = getActiveWallet();
    if (!activeWallet) {
      toast.error(locale === "zh" ? "钱包数据丢失，请重新开始" : "Wallet data lost, please restart");
      return;
    }
    setPwConfirmLoading(true);
    setPwConfirmError(false);
    try {
      await decryptWallet(activeWallet.keystore, pendingPw); // 验证密码正确
      if (hasExecutedRef.current) return;
      hasExecutedRef.current = true;
      await doCreateAndSave(pendingPw);
    } catch {
      setPwConfirmError(true);
      toast.error(t("auth.incorrectPassword", locale));
      setPendingPw("");
    } finally {
      setPwConfirmLoading(false);
    }
  };

  const handleRetry = () => {
    hasExecutedRef.current = false;
    const pw = needPasswordConfirm ? pendingPw : password;
    doCreateAndSave(pw).then(() => { hasExecutedRef.current = true; });
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setAddressCopied(true);
    toast.success(t("create.addressCopied", locale));
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // 密码确认阶段 UI（有已存钱包时先确认密码）
  if (confirmingPassword && !walletAddress) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center h-14"><ProgressBar step={4} total={4} /></div>
        <div className="flex-1 flex flex-col items-center px-6 lg:px-8 lg:max-w-md lg:mx-auto lg:w-full">
          <div className="mt-12 mb-6">
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Lock className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ogbo-blue)]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">
            {locale === "zh" ? "输入钱包密码" : "Enter Wallet Password"}
          </h2>
          <p className="text-sm text-muted-foreground mb-8 text-center">
            {locale === "zh" ? "用于加密新创建的钱包" : "To encrypt the newly created wallet"}
          </p>
          <div className="w-full space-y-3">
            <PasswordInput
              value={pendingPw}
              onChange={v => { setPendingPw(v); setPwConfirmError(false); }}
              placeholder={t("auth.enterPassword", locale)}
              error={pwConfirmError}
              autoFocus
            />
            {pwConfirmError && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="text-[var(--ogbo-red)] text-sm flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                <span>{t("auth.incorrectPassword", locale)}</span>
              </motion.p>
            )}
          </div>
          <div className="w-full mt-8">
            <motion.button
              whileHover={pendingPw.length > 0 ? { scale: 1.02 } : {}}
              whileTap={pendingPw.length > 0 ? { scale: 0.98 } : {}}
              disabled={pwConfirmLoading || pendingPw.length === 0}
              onClick={handlePasswordConfirm}
              className={`w-full h-12 lg:h-14 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all text-base ${
                pendingPw.length > 0
                  ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {pwConfirmLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{locale === "zh" ? "验证中..." : "Verifying..."}</span></>
                : <span>{locale === "zh" ? "确认并创建" : "Confirm & Create"}</span>}
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center h-14"><ProgressBar step={4} total={4} /></div>
      <div className="flex-1 flex flex-col items-center px-6 lg:px-8 lg:max-w-md lg:mx-auto lg:w-full overflow-y-auto">

        {/* Success / Encrypting icon */}
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", duration: 0.8, bounce: 0.5 }}
          className={`w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center shadow-lg mt-8 lg:mt-12 ${encryptError ? "bg-[var(--ogbo-red)]" : "bg-[var(--ogbo-green)]"}`}>
          {encryptError ? <AlertCircle className="w-10 h-10 lg:w-12 lg:h-12 text-white" /> : <Check className="w-10 h-10 lg:w-12 lg:h-12 text-white" />}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-bold mt-6">
          {encryptError ? (locale === "zh" ? "创建失败" : "Creation Failed") : t("create.walletCreated", locale)}
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-sm text-muted-foreground mt-1 text-center">
          {encrypting
            ? (locale === "zh" ? "正在加密钱包，请稍候..." : "Encrypting wallet, please wait...")
            : encryptError
            ? encryptError
            : t("create.walletReady", locale)}
        </motion.p>

        {/* Encrypting progress indicator */}
        {encrypting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--ogbo-blue)]" />
            <p className="text-xs text-muted-foreground">{locale === "zh" ? "加密可能需要 1-5 秒..." : "Encryption may take 1-5 seconds..."}</p>
          </motion.div>
        )}

        {/* Error retry */}
        {encryptError && !encrypting && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={handleRetry}
            className="mt-4 px-6 py-2 bg-[var(--ogbo-blue)] text-white rounded-xl font-semibold text-sm hover:bg-[var(--ogbo-blue-hover)] transition-colors">
            {locale === "zh" ? "重试" : "Retry"}
          </motion.button>
        )}

        {/* Network info card */}
        {!encrypting && !encryptError && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="w-full mt-5 bg-gradient-to-r from-muted/50 to-muted rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-2">{t("network.blockchainNetwork", locale)}</p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl text-white shadow-md" style={{ background: network.gradient }}>
                  {network.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{network.name}</h4>
                  <p className="text-xs text-muted-foreground">{network.symbol} Network</p>
                </div>
              </div>
            </motion.div>

            {/* Wallet address card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="w-full mt-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-muted-foreground mb-2">{t("create.walletAddress", locale)}</p>
              <div className="flex items-center justify-between">
                <code className="font-mono text-base lg:text-lg font-semibold">{formatNetworkAddress(walletAddress, network)}</code>
                <button onClick={handleCopyAddress} className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-lg transition-colors">
                  {addressCopied ? <Check className="w-5 h-5 text-[var(--ogbo-green)]" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                </button>
              </div>
            </motion.div>

            {/* Explorer link */}
            <motion.a initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
              href={`${network.explorerUrl}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer"
              className="mt-2 flex items-center gap-1.5 text-sm text-[var(--ogbo-blue)] hover:text-[var(--ogbo-blue-hover)] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /><span>{t("network.viewExplorer", locale)}</span>
            </motion.a>

            {/* Security tips */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="w-full mt-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-2 mb-2">
                <Shield className="w-5 h-5 text-[var(--ogbo-orange)] flex-shrink-0 mt-0.5" />
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 text-sm">{t("create.securityTips", locale)}</h3>
              </div>
              <ul className="space-y-2 ml-7">
                {[t("create.tipBackup", locale), t("create.tipNoShare", locale), t("create.tipKeepPassword", locale)].map((tip, i) => (
                  <li key={i} className="text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                    <span className="text-[var(--ogbo-orange)]">{"."}</span><span>{tip}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="w-full mt-6 pb-6">
              <motion.button
                whileHover={!encrypting ? { scale: 1.02 } : {}}
                whileTap={!encrypting ? { scale: 0.98 } : {}}
                disabled={encrypting}
                onClick={() => { toast.success(t("create.welcomeToOGBO", locale)); setTimeout(() => onSuccess(walletAddress), 300); }}
                className={`w-full h-12 lg:h-14 gradient-primary text-white rounded-xl font-semibold shadow-lg flex items-center justify-center gap-2 text-base ${encrypting ? "opacity-50 cursor-not-allowed" : ""}`}>
                {encrypting
                  ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{locale === "zh" ? "正在加密..." : "Encrypting..."}</span></>
                  : <><span>{t("create.startUsing", locale)}</span><Rocket className="w-5 h-5" /></>}
              </motion.button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

// ========================================
// 7) IMPORT WALLET - SELECT METHOD
// ========================================
function ImportSelectView({ goTo }: { goTo: (v: AuthView) => void }) {
  const { locale } = useStore();
  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("welcome")} />
      <div className="flex-1 px-6 lg:px-8 lg:max-w-md lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("import.title", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("import.selectMethod", locale)}</p>
        <div className="space-y-4">
          <motion.div whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => goTo("import-mnemonic")}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 rounded-xl p-5 lg:p-6 border-2 border-blue-200 dark:border-blue-800 cursor-pointer shadow-md hover:shadow-lg transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[var(--ogbo-blue)] rounded-xl flex items-center justify-center flex-shrink-0"><FileText className="w-6 h-6 text-white" /></div>
              <div className="flex-1"><h3 className="text-lg font-semibold mb-1">{t("import.mnemonicMethod", locale)}</h3><p className="text-sm text-muted-foreground mb-3">{t("import.mnemonicDesc", locale)}</p>
                <div className="flex items-center text-[var(--ogbo-blue)] font-semibold text-sm"><span>{t("import.select", locale)}</span><ChevronRight className="w-4 h-4 ml-1" /></div>
              </div>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02, y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => goTo("import-privatekey")}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 rounded-xl p-5 lg:p-6 border-2 border-purple-200 dark:border-purple-800 cursor-pointer shadow-md hover:shadow-lg transition-all">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[var(--ogbo-purple)] rounded-xl flex items-center justify-center flex-shrink-0"><Key className="w-6 h-6 text-white" /></div>
              <div className="flex-1"><h3 className="text-lg font-semibold mb-1">{t("import.privateKeyMethod", locale)}</h3><p className="text-sm text-muted-foreground mb-3">{t("import.privateKeyDesc", locale)}</p>
                <div className="flex items-center text-[var(--ogbo-purple)] font-semibold text-sm"><span>{t("import.select", locale)}</span><ChevronRight className="w-4 h-4 ml-1" /></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// 8) IMPORT - MNEMONIC
// ========================================
function ImportMnemonicView({ goTo, onConfirm }: {
  goTo: (v: AuthView) => void;
  onConfirm: (mnemonic: string) => void;
}) {
  const { locale } = useStore();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const words = input.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  // UI 层只做基础格式检查（12词），ethers 会在后续步骤做完整 BIP39 验证
  const validCount = words.filter((w) => BIP39_SAMPLE.includes(w.toLowerCase())).length;
  // 主要依赖 ethers isValidMnemonic 做最终校验
  const isValid = wordCount === 12 && ethersIsValidMnemonic(input.trim());

  const handlePaste = async () => {
    try { const text = await navigator.clipboard.readText(); setInput(text); toast.success(t("import.pasted", locale)); } catch { toast.error("Clipboard not available"); }
  };

  const handleNext = () => {
    // 优先读取 DOM 原始值，兼容输入法粘贴未触发 onChange 的边缘情况
    const domValue = textareaRef.current?.value ?? input;
    if (domValue !== input) setInput(domValue);
    const trimmed = domValue.trim();
    if (!trimmed) {
      toast.error(t("import.pleaseEnterMnemonic", locale));
      return;
    }
    const ws = trimmed.split(/\s+/).filter(Boolean);
    if (ws.length !== 12) {
      toast.error(t("import.mustBe12Words", locale));
      return;
    }
    if (!ethersIsValidMnemonic(trimmed)) {
      toast.error(t("import.someWordsInvalid", locale));
      return;
    }
    onConfirm(trimmed);
    goTo("import-network");
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("import-select")} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-md lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("import.viaMnemonic", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("import.enter12Words", locale)}</p>
        <div className="relative">
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("import.mnemonicPlaceholder", locale)} spellCheck={false}
            className="w-full h-40 lg:h-48 p-4 pr-20 border-2 border-border rounded-xl focus:border-[var(--ogbo-blue)] focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 resize-none font-mono text-sm bg-card outline-none transition-all" />
          <button onClick={handlePaste} className="absolute top-3 right-3 px-3 py-1.5 bg-muted hover:bg-accent rounded-lg flex items-center gap-1 text-sm text-muted-foreground transition-colors">
            <Clipboard className="w-4 h-4" /><span>{t("import.paste", locale)}</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{t("import.separateWithSpaces", locale)}</p>
        <div className="mt-4">
          {isValid ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 text-sm text-[var(--ogbo-green)] font-semibold">
              <CheckCircle className="w-5 h-5" /><span>{t("import.recognized", locale)} {wordCount}/12 {t("import.words", locale)}</span>
            </motion.div>
          ) : wordCount > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--ogbo-orange)]"><AlertCircle className="w-5 h-5" /><span>{t("import.recognized", locale)} {validCount}/{wordCount} {t("import.words", locale)}</span></div>
              {!isValid && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex gap-2"><AlertCircle className="w-5 h-5 text-[var(--ogbo-red)] flex-shrink-0" /><p className="text-sm text-red-800 dark:text-red-300">{wordCount !== 12 ? t("import.mustBe12Words", locale) : t("import.someWordsInvalid", locale)}</p></div>
                </motion.div>
              )}
            </div>
          ) : <span className="text-sm text-muted-foreground">{t("import.pleaseEnterMnemonic", locale)}</span>}
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          className="w-full h-12 lg:h-14 rounded-xl font-semibold mt-6 flex items-center justify-center gap-2 transition-all text-base bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]">
          <span>{t("create.next", locale)}</span><ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// 9) IMPORT - PRIVATE KEY
// ========================================
function ImportPrivateKeyView({ goTo, onConfirm }: {
  goTo: (v: AuthView) => void;
  onConfirm: (privateKey: string) => void;
}) {
  const { locale } = useStore();
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 归一化：自动补全 0x 前缀（用于实时反馈指示器）
  const normalized = input.trim().startsWith("0x") ? input.trim() : "0x" + input.trim();
  const hexPart = normalized.slice(2);
  const isValidHex = /^[0-9a-fA-F]*$/.test(hexPart);
  const isValid = hexPart.length === 64 && isValidHex;

  const handlePaste = async () => {
    try { const text = await navigator.clipboard.readText(); setInput(text); toast.success(t("import.pasted", locale)); } catch { toast.error("Clipboard not available"); }
  };

  const handleNext = () => {
    // 优先读取 DOM 原始值，兼容输入法粘贴未触发 onChange 的边缘情况
    const domValue = inputRef.current?.value ?? input;
    if (domValue !== input) setInput(domValue);
    const trimmed = domValue.trim();
    if (!trimmed) {
      toast.error(t("import.pleaseEnterPrivateKey", locale));
      return;
    }
    const norm = trimmed.startsWith("0x") ? trimmed : "0x" + trimmed;
    const hex = norm.slice(2);
    if (hex.length !== 64 || !/^[0-9a-fA-F]*$/.test(hex)) {
      toast.error(t("import.invalidPrivateKey", locale));
      return;
    }
    onConfirm(norm);
    goTo("import-network");
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("import-select")} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-md lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("import.viaPrivateKey", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("import.enter64Chars", locale)}</p>
        <div className="relative">
          <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input ref={inputRef} type={show ? "text" : "password"} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("import.privateKeyPlaceholder", locale)} spellCheck={false}
            className="w-full h-14 pl-12 pr-24 border-2 border-border rounded-xl focus:border-[var(--ogbo-blue)] focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 font-mono text-sm bg-card outline-none transition-all" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
            <button onClick={handlePaste} className="px-2 py-1 bg-muted hover:bg-accent rounded text-xs text-muted-foreground transition-colors"><Clipboard className="w-4 h-4" /></button>
            <button onClick={() => setShow(!show)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {hexPart.length === 64 && isValidHex ? <Check className="w-4 h-4 text-[var(--ogbo-green)]" /> : input.length > 0 ? <AlertCircle className="w-4 h-4 text-[var(--ogbo-orange)]" /> : <X className="w-4 h-4 text-muted-foreground" />}
            <span className={hexPart.length === 64 && isValidHex ? "text-[var(--ogbo-green)]" : input.length > 0 ? "text-[var(--ogbo-orange)]" : "text-muted-foreground"}>64 {t("import.hexChars", locale)} ({Math.min(hexPart.length, 64)}/64)</span>
          </div>
          {isValid && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 text-sm text-[var(--ogbo-green)] font-semibold">
              <CheckCircle className="w-5 h-5" /><span>{t("import.privateKeyValid", locale)}</span>
            </motion.div>
          )}
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          className="w-full h-12 lg:h-14 rounded-xl font-semibold mt-8 flex items-center justify-center gap-2 transition-all text-base bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]">
          <span>{t("create.next", locale)}</span><ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// 10) IMPORT - SET PASSWORD
// ========================================
function ImportPasswordView({
  goTo, onSuccess, network, importInput, importType,
}: {
  goTo: (v: AuthView) => void;
  onSuccess: (address?: string) => void;
  network: BlockchainNetwork;
  importInput: string;
  importType: "mnemonic" | "privatekey";
}) {
  const { locale } = useStore();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = getPasswordStrength(pw);
  const checks = useMemo(() => ({ min8: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), num: /[0-9]/.test(pw) }), [pw]);
  const isMatch = confirmPw.length === 0 || pw === confirmPw;
  const canProceed = checks.min8 && checks.upper && checks.lower && checks.num && pw === confirmPw && confirmPw.length > 0;
  const strengthColor = strength === "weak" ? "var(--ogbo-red)" : strength === "medium" ? "var(--ogbo-orange)" : "var(--ogbo-green)";
  const strengthLabel = t(`create.strength${strength.charAt(0).toUpperCase() + strength.slice(1)}`, locale);

  const handleComplete = async () => {
    if (!canProceed) return;
    setLoading(true);
    try {
      // 推导钱包（ethers 做完整验证，无效时 throw）
      const wallet = importType === "mnemonic"
        ? walletFromMnemonic(importInput)
        : walletFromPrivateKey(importInput);

      // 检查钱包是否已存在（排除外部钱包：外部钱包无 keystore，允许导入同地址私钥进行升级）
      const existingWallets = getStoredWallets();
      const duplicate = existingWallets.find(
        w => w.address.toLowerCase() === wallet.address.toLowerCase()
          && w.type !== 'external'
          && !!w.keystore
      );

      if (duplicate) {
        // 钱包已存在：更新 active 并直接登录，无需重新加密
        setActiveWalletId(duplicate.id);
        storeSessionKey(wallet.privateKey);
        toast.success(locale === "zh" ? "已有该钱包，已切换到此钱包" : "Wallet already exists, switched to it");
        setTimeout(() => onSuccess(wallet.address), 300);
        return;
      }

      // 新钱包：加密存储
      const keystore = await encryptWallet(wallet, pw);
      const savedWallet = saveWallet({
        name: generateWalletName(),
        network: network.id,
        address: wallet.address,
        keystore,
      });
      setActiveWalletId(savedWallet.id);
      storeSessionKey(wallet.privateKey);

      toast.success(t("import.walletImported", locale));
      setTimeout(() => onSuccess(wallet.address), 300);
    } catch (e: any) {
      const msg = e?.message?.includes("invalid mnemonic") || e?.message?.includes("Invalid mnemonic")
        ? (locale === "zh" ? "助记词无效，请检查输入" : "Invalid mnemonic, please check input")
        : e?.message?.includes("invalid private key") || e?.message?.includes("Invalid private key")
        ? (locale === "zh" ? "私钥格式无效，请检查输入" : "Invalid private key format")
        : (locale === "zh" ? "导入失败，请检查输入是否正确" : "Import failed, please check your input");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader onBack={() => goTo("import-network")} rightSlot={<NetworkIndicator network={network} />} />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-md lg:mx-auto lg:w-full">
        <h2 className="text-2xl font-bold mt-4 lg:mt-8">{t("create.setPassword", locale)}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">{t("import.setPasswordDesc", locale)}</p>
        <label htmlFor="imp-pw" className="text-sm font-medium mb-2 block">{t("auth.enterPassword", locale)}</label>
        <PasswordInput id="imp-pw" value={pw} onChange={setPw} placeholder={t("create.passwordMin8", locale)} autoFocus />
        {pw.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("create.passwordStrength", locale)}:</span>
              <div className="flex gap-1 flex-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-1 rounded-full flex-1" animate={{ backgroundColor: (i === 0) ? strengthColor : (i === 1 && strength !== "weak") ? strengthColor : (i === 2 && strength === "strong") ? strengthColor : "hsl(var(--border))" }} transition={{ duration: 0.2 }} />
                ))}
              </div>
              <span className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
            </div>
          </motion.div>
        )}
        <div className="mt-4 space-y-2">
          {([
            { key: "min8", label: t("create.atLeast8Chars", locale), met: checks.min8 },
            { key: "upper", label: t("create.includeUppercase", locale), met: checks.upper },
            { key: "lower", label: t("create.includeLowercase", locale), met: checks.lower },
            { key: "num", label: t("create.includeNumber", locale), met: checks.num },
          ] as const).map((item) => (
            <div key={item.key} className="flex items-center gap-2 text-sm">
              {item.met ? <Check className="w-4 h-4 text-[var(--ogbo-green)]" /> : <X className="w-4 h-4 text-muted-foreground" />}
              <span className={item.met ? "text-[var(--ogbo-green)]" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>
        <label htmlFor="imp-confirm" className="text-sm font-medium mb-2 block mt-6">{t("create.confirmPassword", locale)}</label>
        <PasswordInput id="imp-confirm" value={confirmPw} onChange={setConfirmPw} placeholder={t("create.confirmPassword", locale)} error={!isMatch} />
        {!isMatch && confirmPw.length > 0 && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[var(--ogbo-red)] text-sm mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /><span>{t("create.passwordMismatch", locale)}</span>
          </motion.p>
        )}
        <motion.button whileHover={canProceed ? { scale: 1.02 } : {}} whileTap={canProceed ? { scale: 0.98 } : {}}
          disabled={!canProceed || loading} onClick={handleComplete}
          className={`w-full h-12 lg:h-14 rounded-xl font-semibold mt-8 flex items-center justify-center gap-2 transition-all text-base ${canProceed ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]" : "bg-muted text-muted-foreground cursor-not-allowed"}`}>
          {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>{t("import.importing", locale)}</span></>) : (<><span>{t("import.importAndLogin", locale)}</span><ChevronRight className="w-5 h-5" /></>)}
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// 10-B) IMPORT - CONFIRM EXISTING PASSWORD (有已存钱包时走此流程)
// ========================================
function ImportConfirmPasswordView({
  goTo, onSuccess, network, importInput, importType,
}: {
  goTo: (v: AuthView) => void;
  onSuccess: (address?: string) => void;
  network: BlockchainNetwork;
  importInput: string;
  importType: "mnemonic" | "privatekey";
}) {
  const { locale } = useStore();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleComplete = async () => {
    const existingWallet = getActiveWallet();
    if (!existingWallet) {
      toast.error(locale === "zh" ? "钱包数据丢失，请重新开始" : "Wallet data lost, please restart");
      goTo("welcome");
      return;
    }
    if (!pw) return;
    setLoading(true);
    setError(false);
    try {
      // 验证现有密码
      await decryptWallet(existingWallet.keystore, pw);

      // 推导新钱包
      const wallet = importType === "mnemonic"
        ? walletFromMnemonic(importInput)
        : walletFromPrivateKey(importInput);

      // 检查是否重复地址（排除外部钱包，允许导入同地址私钥升级为 imported 类型）
      const existingWallets = getStoredWallets();
      const duplicate = existingWallets.find(
        w => w.address.toLowerCase() === wallet.address.toLowerCase()
          && w.type !== 'external'
          && !!w.keystore
      );

      if (duplicate) {
        setActiveWalletId(duplicate.id);
        storeSessionKey(wallet.privateKey);
        toast.success(locale === "zh" ? "已有该钱包，已切换到此钱包" : "Wallet already exists, switched to it");
        setTimeout(() => onSuccess(wallet.address), 300);
        return;
      }

      // 新钱包：用已有密码加密
      const keystore = await encryptWallet(wallet, pw);
      const savedWallet = saveWallet({
        name: generateWalletName(),
        network: network.id,
        address: wallet.address,
        keystore,
      });
      setActiveWalletId(savedWallet.id);
      storeSessionKey(wallet.privateKey);
      toast.success(t("import.walletImported", locale));
      setTimeout(() => onSuccess(wallet.address), 300);
    } catch (e: any) {
      const isKeyError = e?.message?.includes("invalid mnemonic") || e?.message?.includes("Invalid mnemonic")
        || e?.message?.includes("invalid private key") || e?.message?.includes("Invalid private key");
      if (isKeyError) {
        toast.error(locale === "zh" ? "助记词或私钥无效" : "Invalid mnemonic or private key");
      } else {
        setError(true);
        toast.error(t("auth.incorrectPassword", locale));
        setPw("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <BackHeader
        onBack={() => goTo("import-network")}
        rightSlot={<NetworkIndicator network={network} />}
      />
      <div className="flex-1 overflow-y-auto px-6 lg:px-8 pb-6 lg:max-w-md lg:mx-auto lg:w-full">
        <div className="mt-8 mb-6 flex justify-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
            <Lock className="w-8 h-8 lg:w-10 lg:h-10 text-[var(--ogbo-blue)]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mt-2 lg:mt-4">
          {locale === "zh" ? "输入钱包密码" : "Enter Wallet Password"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 mb-8">
          {locale === "zh" ? "用于加密导入的新钱包" : "To encrypt the newly imported wallet"}
        </p>
        <label className="text-sm font-medium mb-2 block">{t("auth.enterPassword", locale)}</label>
        <PasswordInput
          value={pw}
          onChange={v => { setPw(v); setError(false); }}
          placeholder={t("auth.enterPassword", locale)}
          error={error}
          autoFocus
        />
        {error && (
          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
            className="text-[var(--ogbo-red)] text-sm mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /><span>{t("auth.incorrectPassword", locale)}</span>
          </motion.p>
        )}
        <motion.button
          whileHover={pw.length > 0 && !loading ? { scale: 1.02 } : {}}
          whileTap={pw.length > 0 && !loading ? { scale: 0.98 } : {}}
          disabled={!pw || loading}
          onClick={handleComplete}
          className={`w-full h-12 lg:h-14 rounded-xl font-semibold mt-8 flex items-center justify-center gap-2 transition-all text-base ${
            pw.length > 0
              ? "bg-[var(--ogbo-blue)] text-white shadow-md hover:bg-[var(--ogbo-blue-hover)]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /><span>{t("import.importing", locale)}</span></>
            : <><span>{t("import.importAndLogin", locale)}</span><ChevronRight className="w-5 h-5" /></>}
        </motion.button>
      </div>
    </div>
  );
}

// ========================================
// MAIN LOGIN APP
// ========================================
export default function LoginApp({
  initialView,
  isModal,
  onModalSuccess,
  onModalClose,
}: {
  initialView?: AuthView;
  isModal?: boolean;
  onModalSuccess?: () => void;
  onModalClose?: () => void;
} = {}) {
  const [view, setView] = useState<AuthView>(initialView ?? "welcome");
  const [direction, setDirection] = useState<"right" | "left">("right");
  const [selectedNetwork, setSelectedNetwork] = useState<BlockchainNetwork>(SUPPORTED_NETWORKS[0]);
  const [showNetworkSwitcher, setShowNetworkSwitcher] = useState(false);
  const { locale, login } = useStore();

  // ---- Session state: 跨视图数据传递（不写入存储，只用于当前创建/导入流程）----
  const [sessionPassword, setSessionPassword] = useState("");
  const [sessionMnemonic, setSessionMnemonic] = useState("");
  const [sessionImportInput, setSessionImportInput] = useState("");
  const [sessionImportType, setSessionImportType] = useState<"mnemonic" | "privatekey">("mnemonic");

  const clearSession = useCallback(() => {
    setSessionPassword("");
    setSessionMnemonic("");
    setSessionImportInput("");
    setSessionImportType("mnemonic");
  }, []);

  const goTo = useCallback((v: AuthView) => {
    const viewOrder: AuthView[] = [
      "welcome", "password-login", "login",
      "create-network", "create-password", "create-generate", "create-verify", "create-complete",
      "import-select", "import-mnemonic", "import-privatekey", "import-network",
      "import-password", "import-confirm-password",
    ];
    const currentIdx = viewOrder.indexOf(view);
    const nextIdx = viewOrder.indexOf(v);
    setDirection(nextIdx >= currentIdx ? "right" : "left");
    setView(v);
  }, [view]);

  // Modal 模式下：当子视图尝试返回 "welcome"（即最顶层）时，关闭 modal 而不是显示欢迎页
  // Standalone 模式下：行为与 goTo 完全一致
  const effectiveGoTo = useCallback((v: AuthView) => {
    if (isModal && v === "welcome") {
      onModalClose?.();
      return;
    }
    goTo(v);
  }, [isModal, onModalClose, goTo]);

  const handleSuccess = useCallback((address?: string) => {
    clearSession(); // 清除内存中的 session 状态
    login(address);
    if (isModal) {
      onModalSuccess?.();
    } else {
      window.location.replace("./index.html");
    }
  }, [login, clearSession, isModal, onModalSuccess]);

  // SSR 安全：每次渲染时动态检测已存钱包（仅统计有 keystore 的 imported 钱包，外部钱包不影响路由）
  const hasExistingWallet = () => {
    if (typeof window === "undefined") return false;
    return getStoredWallets().filter((w) => w.type !== 'external' && !!w.keystore).length > 0;
  };

  const variants = direction === "right" ? slideRight : slideLeft;

  return (
    <div className="h-dvh w-full bg-background flex items-center justify-center">
      {/* App Download Banner - Web only (hidden in modal mode) */}
      {!isModal && <AppDownloadBanner />}

      {/* Toaster - only render when standalone (modal mode reuses parent page's Toaster) */}
      {!isModal && (
        <Toaster position="top-center" toastOptions={{
          duration: 2500,
          style: { background: "hsl(var(--card))", color: "hsl(var(--card-foreground))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "13px", fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
        }} />
      )}

      <div className="w-full h-full lg:max-w-lg lg:h-[720px] lg:max-h-[90vh] lg:rounded-2xl lg:border lg:border-border lg:shadow-2xl lg:overflow-hidden relative bg-background">
        {/* Modal close button */}
        {isModal && (
          <button
            onClick={() => onModalClose?.()}
            className="absolute z-20 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-1.5 transition-colors"
            style={{
              top: 'calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 12px)',
              right: '12px',
            }}
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={view} variants={variants} initial="initial" animate="animate" exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-0 overflow-hidden">
            {view === "welcome" && <WelcomeView goTo={effectiveGoTo} />}
            {view === "password-login" && <PasswordLoginView goTo={effectiveGoTo} onSuccess={handleSuccess} />}
            {view === "login" && <LoginView goTo={effectiveGoTo} onSuccess={handleSuccess} />}
            {view === "create-network" && (
              <NetworkSelectionView
                goTo={effectiveGoTo}
                nextView={hasExistingWallet() ? "create-generate" : "create-password"}
                backView="welcome"
                descKey="network.whichChainCreate"
                onSelectNetwork={setSelectedNetwork}
              />
            )}
            {view === "create-password" && <CreatePasswordView goTo={effectiveGoTo} network={selectedNetwork} onSwitchNetwork={() => setShowNetworkSwitcher(true)} onPasswordSet={setSessionPassword} />}
            {view === "create-generate" && (
              <CreateGenerateView
                goTo={effectiveGoTo}
                network={selectedNetwork}
                onMnemonicGenerated={setSessionMnemonic}
                backView={hasExistingWallet() ? "create-network" : "create-password"}
              />
            )}
            {view === "create-verify" && <CreateVerifyView goTo={effectiveGoTo} network={selectedNetwork} mnemonic={sessionMnemonic} />}
            {view === "create-complete" && <CreateCompleteView onSuccess={handleSuccess} network={selectedNetwork} mnemonic={sessionMnemonic} password={sessionPassword} />}
            {view === "import-select" && <ImportSelectView goTo={effectiveGoTo} />}
            {view === "import-mnemonic" && <ImportMnemonicView goTo={effectiveGoTo} onConfirm={(input) => { setSessionImportInput(input); setSessionImportType("mnemonic"); }} />}
            {view === "import-privatekey" && <ImportPrivateKeyView goTo={effectiveGoTo} onConfirm={(input) => { setSessionImportInput(input); setSessionImportType("privatekey"); }} />}
            {view === "import-network" && (
              <NetworkSelectionView
                goTo={effectiveGoTo}
                nextView={hasExistingWallet() ? "import-confirm-password" : "import-password"}
                backView="import-select"
                descKey="network.whichChainImport"
                onSelectNetwork={setSelectedNetwork}
              />
            )}
            {view === "import-password" && <ImportPasswordView goTo={effectiveGoTo} onSuccess={handleSuccess} network={selectedNetwork} importInput={sessionImportInput} importType={sessionImportType} />}
            {view === "import-confirm-password" && (
              <ImportConfirmPasswordView
                goTo={effectiveGoTo}
                onSuccess={handleSuccess}
                network={selectedNetwork}
                importInput={sessionImportInput}
                importType={sessionImportType}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <NetworkSwitcherSheet
        open={showNetworkSwitcher}
        onClose={() => setShowNetworkSwitcher(false)}
        selectedNetwork={selectedNetwork}
        onSelect={(n) => setSelectedNetwork(n)}
        locale={locale}
      />
    </div>
  );
}
