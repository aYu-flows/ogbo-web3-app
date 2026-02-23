import { useEffect } from "react";
import { BUNDLE_VERSION } from "./ota-version";

// Stable URL — always points to the latest OTA manifest on GitHub Releases.
// The manifest is overwritten in-place (--clobber) on every OTA release.
const MANIFEST_URL =
  "https://github.com/aYu-flows/ogbo-web3-app/releases/download/ota-latest/ota-manifest.json";

/**
 * Core OTA update logic. Exported for unit testing.
 *
 * Execution steps (Android Capacitor only):
 * 1. notifyAppReady() — declare the current bundle is healthy
 * 2. Fetch version manifest from GitHub Releases (ota-latest tag)
 * 3. Compare manifest.version with BUNDLE_VERSION
 * 4. If newer: download bundle, schedule with next()
 *
 * All errors are silently caught and warned.
 */
export async function runOtaUpdate(): Promise<void> {
  // Guard: only run inside Android Capacitor
  const cap = (typeof window !== "undefined") ? (window as any).Capacitor : undefined;
  if (!cap || cap.getPlatform?.() !== "android") return;

  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

  // Always notify the plugin that the current bundle loaded successfully.
  // This resets the rollback counter after an OTA update.
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {
    console.warn("[OTA] notifyAppReady failed:", e);
  }

  // Fetch version manifest (cache-busted)
  let manifest: { version?: string; url?: string } | null = null;
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
    manifest = await res.json();
  } catch (e) {
    console.warn("[OTA] Failed to fetch manifest:", e);
    return;
  }

  // Validate manifest fields
  if (
    !manifest ||
    typeof manifest.version !== "string" ||
    !manifest.version ||
    typeof manifest.url !== "string" ||
    !manifest.url.startsWith("https://")
  ) {
    console.warn("[OTA] Invalid manifest:", manifest);
    return;
  }

  // No update needed
  if (manifest.version === BUNDLE_VERSION) return;

  // Download new bundle in background
  let bundle;
  try {
    bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });
  } catch (e) {
    console.warn("[OTA] Download failed:", e);
    return;
  }

  // Schedule for next app background / cold start (non-intrusive)
  try {
    await CapacitorUpdater.next({ id: bundle.id });
    console.info(`[OTA] Bundle ${manifest.version} scheduled for next restart.`);
  } catch (e) {
    console.warn("[OTA] Failed to schedule bundle:", e);
  }
}

/**
 * OTA update hook for Android Capacitor builds.
 *
 * Must be called unconditionally at the top of the root page component,
 * before any early-return branches, so notifyAppReady() is always reached.
 */
export function useOtaUpdater(): void {
  useEffect(() => {
    runOtaUpdate();
  }, []);
}
