"use client";

import { useEffect } from "react";

export default function StatusBarConfig() {
  useEffect(() => {
    // Only run in Capacitor app
    if (typeof window !== "undefined" && (window as any).Capacitor) {
      import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
        // Set status bar style to Light (dark icons on light background)
        StatusBar.setStyle({ style: Style.Light }).catch((error) => {
          console.log("StatusBar setStyle error:", error);
        });

        // Set status bar background to white
        StatusBar.setBackgroundColor({ color: "#ffffff" }).catch((error) => {
          console.log("StatusBar setBackgroundColor error:", error);
        });
      }).catch((error) => {
        console.log("StatusBar import error:", error);
      });
    }
  }, []);

  return null;
}
