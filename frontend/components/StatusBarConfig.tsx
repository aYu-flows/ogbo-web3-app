"use client";

import { useEffect } from "react";

export default function StatusBarConfig() {
  useEffect(() => {
    // ── Safe area CSS variable injection ──────────────────────────────────
    // Inject --ogbo-safe-area-top as a JS-controlled CSS custom property.
    // This fixes the Capacitor Android timing issue where env(safe-area-inset-top)
    // may read as 0 on first render because native insets are injected asynchronously.
    // Setting a CSS custom property triggers an immediate browser CSS re-evaluation
    // for all elements using var(--ogbo-safe-area-top), with no React re-render needed.
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;" +
      "padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);

    const updateSafeArea = () => {
      const pt = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
      document.documentElement.style.setProperty(
        "--ogbo-safe-area-top",
        `${pt}px`
      );
    };

    // Read immediately (synchronous layout)
    updateSafeArea();
    // Read after first paint (covers initial Capacitor async injection)
    const t0 = setTimeout(updateSafeArea, 0);
    // Read after a short delay (covers slower native bridges, e.g. older Android)
    const t1 = setTimeout(updateSafeArea, 150);

    window.addEventListener("resize", updateSafeArea);
    window.addEventListener("orientationchange", updateSafeArea);

    // ── Capacitor StatusBar style ─────────────────────────────────────────
    if ((window as any).Capacitor) {
      import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Light }).catch((error) => {
          console.log("StatusBar setStyle error:", error);
        });
        StatusBar.setBackgroundColor({ color: "#ffffff" }).catch((error) => {
          console.log("StatusBar setBackgroundColor error:", error);
        });
        // Re-read safe area after status bar is configured
        setTimeout(updateSafeArea, 300);
      }).catch((error) => {
        console.log("StatusBar import error:", error);
      });
    }

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      window.removeEventListener("resize", updateSafeArea);
      window.removeEventListener("orientationchange", updateSafeArea);
      if (probe.parentNode) probe.parentNode.removeChild(probe);
    };
  }, []);

  return null;
}
