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
      } else if (platform === "ios") {
        // iOS: keep overlay mode — env(safe-area-inset-top) is injected reliably
        // by WKWebView at initialisation; no timing issue exists on iOS.
        StatusBar.setStyle({ style: Style.Dark }).catch(console.warn);
      }
    }).catch(console.warn);
  }, []);

  return null;
}
