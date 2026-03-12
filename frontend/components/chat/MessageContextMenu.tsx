"use client";

import React from "react";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, CheckSquare } from "lucide-react";
import { t } from "@/lib/i18n";

interface MessageContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  locale: "zh" | "en";
  onDelete: () => void;
  onMultiSelect: () => void;
  onClose: () => void;
}

export default function MessageContextMenu({
  visible,
  x,
  y,
  locale,
  onDelete,
  onMultiSelect,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use timeout to avoid capturing the same event that opened the menu
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("touchstart", handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [visible, onClose]);

  // Compute position (avoid going off-screen)
  const adjustedStyle = (): React.CSSProperties => {
    const menuWidth = 140;
    const menuHeight = 96;
    let left = x - menuWidth / 2;
    let top = y - menuHeight - 8;

    // Clamp horizontal
    if (left < 8) left = 8;
    if (typeof window !== "undefined" && left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    // If above would go off-screen, show below
    if (top < 8) {
      top = y + 8;
    }
    return { position: "fixed", left, top, zIndex: 9999 };
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.15 }}
          style={adjustedStyle()}
          className="bg-card border border-border shadow-lg rounded-xl overflow-hidden min-w-[140px]"
        >
          <button
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span className="text-red-500 font-medium">
              {t("chat.msg.delete", locale)}
            </span>
          </button>
          <div className="h-px bg-border" />
          <button
            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            onClick={(e) => {
              e.stopPropagation();
              onMultiSelect();
            }}
          >
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
            <span>{t("chat.msg.multiSelect", locale)}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
