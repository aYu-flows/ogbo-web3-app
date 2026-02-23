import { useEffect } from "react";
import { BUNDLE_VERSION } from "./ota-version";
import { useStore } from "./store";
import { supabase } from "./supabaseClient";

// Stable URL — always points to the latest OTA manifest on GitHub Releases.
// The manifest is overwritten in-place (--clobber) on every OTA release.
const MANIFEST_URL =
  "https://github.com/aYu-flows/ogbo-web3-app/releases/download/ota-latest/ota-manifest.json";

/** Fire-and-forget diagnostic log → Supabase ota_debug_log table. */
function otaLog(step: string, data?: Record<string, unknown>): void {
  supabase
    .from("ota_debug_log")
    .insert({ step, bundle_version: BUNDLE_VERSION, data: data ?? null })
    .then(({ error }) => {
      if (error) console.warn("[OTA-LOG] Supabase insert error:", error.message);
    });
}

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

  otaLog("START", { platform: cap.getPlatform?.() });

  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

  // Always notify the plugin that the current bundle loaded successfully.
  try {
    await CapacitorUpdater.notifyAppReady();
    otaLog("NOTIFY_APP_READY_OK");
  } catch (e: any) {
    console.warn("[OTA] notifyAppReady failed:", e);
    otaLog("NOTIFY_APP_READY_FAIL", { error: String(e) });
  }

  // Fetch version manifest (cache-busted)
  const fetchUrl = `${MANIFEST_URL}?t=${Date.now()}`;
  otaLog("MANIFEST_FETCH_START", { url: fetchUrl });

  let manifest: { version?: string; url?: string } | null = null;
  try {
    const res = await fetch(fetchUrl);
    otaLog("MANIFEST_FETCH_RESPONSE", { status: res.status, ok: res.ok, url: res.url });
    manifest = await res.json();
    otaLog("MANIFEST_FETCH_OK", { manifest });
  } catch (e: any) {
    console.warn("[OTA] Failed to fetch manifest:", e);
    otaLog("MANIFEST_FETCH_FAIL", { error: String(e) });
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
    otaLog("MANIFEST_INVALID", { manifest });
    return;
  }

  // No update needed
  if (manifest.version === BUNDLE_VERSION) {
    otaLog("VERSION_MATCH", { current: BUNDLE_VERSION, remote: manifest.version });
    return;
  }

  otaLog("VERSION_MISMATCH", { current: BUNDLE_VERSION, remote: manifest.version, bundleUrl: manifest.url });

  // Set up download progress listener
  const { setOtaProgress, setOtaDone } = useStore.getState();
  setOtaProgress(0);

  let listenerHandle: { remove: () => void } | null = null;
  let lastLoggedPct = -1;
  try {
    listenerHandle = await CapacitorUpdater.addListener("download", (info: any) => {
      const pct = typeof info.percent === "number" ? info.percent : null;
      setOtaProgress(pct);
      // Log every 25% to avoid flooding
      if (pct !== null && pct - lastLoggedPct >= 25) {
        lastLoggedPct = pct;
        otaLog("DOWNLOAD_PROGRESS", { percent: pct });
      }
    });
    otaLog("LISTENER_SETUP_OK");
  } catch (e: any) {
    otaLog("LISTENER_SETUP_FAIL", { error: String(e) });
    // non-critical, continue without progress tracking
  }

  // Also listen for downloadFailed event
  let failListenerHandle: { remove: () => void } | null = null;
  try {
    failListenerHandle = await CapacitorUpdater.addListener("downloadFailed", (info: any) => {
      otaLog("DOWNLOAD_FAILED_EVENT", { info: JSON.stringify(info) });
    });
  } catch (_) {}

  // Download new bundle in background
  otaLog("DOWNLOAD_START", { url: manifest.url, version: manifest.version });
  let bundle;
  try {
    bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });
    otaLog("DOWNLOAD_OK", { bundleId: bundle.id, version: bundle.version });
  } catch (e: any) {
    console.warn("[OTA] Download failed:", e);
    otaLog("DOWNLOAD_CATCH", { error: String(e) });
    setOtaProgress(null);
    try { listenerHandle?.remove(); } catch (_) {}
    try { failListenerHandle?.remove(); } catch (_) {}
    return;
  }

  try { listenerHandle?.remove(); } catch (_) {}
  try { failListenerHandle?.remove(); } catch (_) {}

  // Schedule for next app background / cold start (non-intrusive)
  try {
    await CapacitorUpdater.next({ id: bundle.id });
    console.info(`[OTA] Bundle ${manifest.version} scheduled for next restart.`);
    otaLog("NEXT_OK", { bundleId: bundle.id, version: manifest.version });
    setOtaProgress(100);
    setOtaDone(true);
    setTimeout(() => {
      setOtaProgress(null);
      setOtaDone(false);
    }, 2500);
  } catch (e: any) {
    console.warn("[OTA] Failed to schedule bundle:", e);
    otaLog("NEXT_FAIL", { error: String(e) });
    setOtaProgress(null);
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
