"use client";

import { useEffect } from "react";

export default function StatusBarConfig() {
  useEffect(() => {
    if (!(window as any).Capacitor) return;

    import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
      const platform = (window as any).Capacitor.getPlatform?.() ?? "";

      if (platform === "android") {
        // Android: non-overlay mode — WebView starts below the status bar.
        // This eliminates the timing race where env(safe-area-inset-top) reads
        // as 0 on cold start because the native bridge injects insets asynchronously.
        // With overlay=false, the OS positions the WebView automatically; no JS
        // inset detection is needed. The status bar background matches the app header.
        StatusBar.setOverlaysWebView({ overlay: false }).catch(console.warn);
        StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(console.warn);
        // Style.Dark = dark icons (black) for light/white status bar background
        StatusBar.setStyle({ style: Style.Dark }).catch(console.warn);
        // Freeze safe area custom properties to 0 for Android.
        // overlay=false means WebView is positioned between status bar and nav bar by the OS,
        // so CSS safe area insets are always 0. Freezing prevents fixed inset-0 modals from
        // triggering a viewport recalculation that updates env() to the actual bar heights.
        document.documentElement.style.setProperty("--safe-top", "0px");
        document.documentElement.style.setProperty("--safe-bottom", "0px");
      } else if (platform === "ios") {
        // iOS: keep overlay mode — env(safe-area-inset-top) is injected reliably
        // by WKWebView at initialisation; no timing issue exists on iOS.
        StatusBar.setStyle({ style: Style.Dark }).catch(console.warn);
        // Store env() expressions as CSS custom property values so they remain
        // dynamically evaluated (responds to orientation changes) but are never
        // overwritten by subsequent viewport recalculations.
        document.documentElement.style.setProperty("--safe-top", "env(safe-area-inset-top, 0px)");
        document.documentElement.style.setProperty("--safe-bottom", "env(safe-area-inset-bottom, 0px)");
      }
    }).catch(console.warn);
  }, []);

  return null;
}
