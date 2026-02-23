"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

/**
 * Thin fixed progress bar at the bottom of the screen shown during OTA downloads.
 * Fades out after the bundle is scheduled. Invisible to most users; useful for testing.
 */
export default function OtaProgressBar() {
  const otaProgress = useStore((s) => s.otaProgress);
  const otaDone = useStore((s) => s.otaDone);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (otaProgress !== null) {
      setVisible(true);
      setFading(false);
    }
  }, [otaProgress]);

  useEffect(() => {
    if (!otaDone) return;
    const t1 = setTimeout(() => setFading(true), 1000);
    const t2 = setTimeout(() => setVisible(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [otaDone]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[200] h-[3px] bg-black/10 dark:bg-white/10 transition-opacity duration-700 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className="h-full bg-[var(--ogbo-blue)] transition-all duration-300 ease-out"
        style={{ width: `${otaProgress ?? 100}%` }}
      />
    </div>
  );
}
