"use client";

import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "ogbox_hide_download_banner";

export default function AppDownloadBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isCapacitor, setIsCapacitor] = useState(false);

  useEffect(() => {
    // Check if running in Capacitor (mobile app)
    const checkCapacitor = () => {
      if (typeof window !== "undefined") {
        const isApp = !!(window as any).Capacitor;
        setIsCapacitor(isApp);

        // Only show banner on web (not in app)
        if (!isApp) {
          const hideFlag = localStorage.getItem(STORAGE_KEY);
          setIsVisible(hideFlag !== "true");
        }
      }
    };

    checkCapacitor();
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  const handleDownload = () => {
    // Trigger APK download
    const link = document.createElement("a");
    link.href = "/download/OGBOX-v1.0.apk";
    link.download = "OGBOX-v1.0.apk";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Don't render in Capacitor app or if closed
  if (isCapacitor || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3 gap-4">
            {/* Left: Logo + Text */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <svg
                  viewBox="0 0 500 500"
                  className="w-6 h-6"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M250 50 L400 150 L400 350 L250 450 L100 350 L100 150 Z"
                    fill="url(#logo-gradient)"
                    opacity="0.9"
                  />
                  <circle cx="250" cy="290" r="30" fill="white" />
                  <path
                    d="M250 150 L250 230 M220 260 L250 230 L280 260"
                    stroke="white"
                    strokeWidth="20"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-white font-semibold text-sm sm:text-base truncate">
                获取 OGBOX app
              </span>
            </div>

            {/* Right: Download Button + Close */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">下载应用</span>
                <span className="sm:hidden">下载</span>
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-blue-700/50 rounded-lg transition-colors text-white"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
