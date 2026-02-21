"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { useStore } from "@/lib/store";
import LoginApp from "@/components/login/LoginApp";
import StatusBarConfig from "@/components/StatusBarConfig";

const APK_URL =
  "https://github.com/aYu-flows/ogbo-web3-app/releases/download/v1.0/OGBOX-v1.0.apk";

export default function LoginPage() {
  const { isLoggedIn, checkAuthStatus, locale } = useStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    // Check authentication status on mount
    checkAuthStatus();

    // Small delay to ensure store is updated
    setTimeout(() => {
      setIsChecking(false);
    }, 100);
  }, [checkAuthStatus]);

  useEffect(() => {
    // Redirect to home if already logged in
    if (!isChecking && isLoggedIn) {
      // Use window.location.replace for Capacitor compatibility
      window.location.replace("./index.html");
    }
  }, [isLoggedIn, isChecking]);

  // Detect browser (non-Capacitor) environment
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsBrowser(!(window as any).Capacitor);
    }
  }, []);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = APK_URL;
    link.download = "OGBOX-v1.0.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show loading while checking
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

  // Show redirecting if already logged in
  if (isLoggedIn) {
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
    <>
      <StatusBarConfig />

      {/* Download APK button — browser only, top-right corner */}
      {isBrowser && (
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.25, ease: "easeOut" }}
          onClick={handleDownload}
          className="fixed top-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ogbo-blue)] hover:bg-[var(--ogbo-blue-hover)] text-white rounded-xl text-xs font-semibold shadow-lg transition-colors"
          aria-label={locale === "zh" ? "下载 OGBOX App" : "Download OGBOX App"}
        >
          <Download className="w-3.5 h-3.5" />
          {locale === "zh" ? "下载 APP" : "Get App"}
        </motion.button>
      )}

      <LoginApp />
    </>
  );
}

