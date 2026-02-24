import { useEffect } from "react";
import { BUNDLE_VERSION } from "./ota-version";
import { useStore } from "./store";
import { supabase } from "./supabaseClient";

// Served from Vercel (same project) — no redirect, no CORS issues on Android WebView.
const MANIFEST_URL = "https://ogbox-web3-app.vercel.app/ota-manifest.json";

/** Fire-and-forget diagnostic log → Supabase ota_debug_log table. */
function otaLog(step: string, data?: Record<string, unknown>): void {
  supabase
    .from("ota_debug_log")
    .insert({ step, bundle_version: BUNDLE_VERSION, data: data ?? null })
    .then(({ error }) => {
      if (error) console.warn("[OTA-LOG] Supabase insert error:", error.message);
    });
}

// ─── Module-level notifyAppReady ─────────────────────────────────────────────
// Called immediately when this module loads (before React mounts).
// Critical: the OTA plugin's rollback timer starts the moment the new bundle
// begins loading. If notifyAppReady() is only called inside useEffect (after
// first paint), the timer may expire first and trigger an unwanted rollback.
if (typeof window !== "undefined") {
  const _cap = (window as any).Capacitor;
  if (_cap?.getPlatform?.() === "android") {
    import("@capgo/capacitor-updater")
      .then(({ CapacitorUpdater }) => CapacitorUpdater.notifyAppReady())
      .catch(() => {});
  }
}

/**
 * Core OTA update logic. Exported for unit testing.
 */
export async function runOtaUpdate(): Promise<void> {
  // Guard: only run inside Android Capacitor
  const cap = (typeof window !== "undefined") ? (window as any).Capacitor : undefined;
  if (!cap || cap.getPlatform?.() !== "android") return;

  const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

  // Log current active bundle info for diagnostics
  let currentInfo: string | null = null;
  try {
    const cur = await (CapacitorUpdater as any).current?.();
    currentInfo = cur?.bundle?.version ?? null;
  } catch (_) {}

  otaLog("START", { platform: cap.getPlatform?.(), activeBundleVersion: currentInfo });

  // notifyAppReady already called at module level; call again here as safety net
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

  otaLog("VERSION_MISMATCH", { current: BUNDLE_VERSION, remote: manifest.version });

  // Set up download progress listener
  const { setOtaProgress, setOtaDone } = useStore.getState();
  setOtaProgress(0);

  let listenerHandle: { remove: () => void } | null = null;
  let lastLoggedPct = -1;
  try {
    listenerHandle = await CapacitorUpdater.addListener("download", (info: any) => {
      const pct = typeof info.percent === "number" ? info.percent : null;
      setOtaProgress(pct);
      if (pct !== null && pct - lastLoggedPct >= 25) {
        lastLoggedPct = pct;
        otaLog("DOWNLOAD_PROGRESS", { percent: pct });
      }
    });
    otaLog("LISTENER_SETUP_OK");
  } catch (e: any) {
    otaLog("LISTENER_SETUP_FAIL", { error: String(e) });
  }

  let failListenerHandle: { remove: () => void } | null = null;
  try {
    failListenerHandle = await CapacitorUpdater.addListener("downloadFailed", (info: any) => {
      otaLog("DOWNLOAD_FAILED_EVENT", { info: JSON.stringify(info) });
    });
  } catch (_) {}

  // Download new bundle
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

  // Wait briefly for the native plugin to fully persist the bundle to its internal
  // storage before calling next(). Without this, next() may fail immediately with
  // "Bundle {id} does not exist" because the write hasn't completed yet.
  await new Promise(r => setTimeout(r, 500));

  // Verify bundle appears in list() and obtain the stored ID.
  // The ID returned by download() may differ from what the native storage uses;
  // calling list() after the delay gives us the canonical stored ID.
  let bundleIdForNext = bundle.id;
  try {
    const listAfter = await CapacitorUpdater.list();
    const stored = (listAfter.bundles ?? []).find(
      (b: any) => b.version === manifest!.version
    );
    if (stored) {
      bundleIdForNext = stored.id;
      otaLog("BUNDLE_VERIFIED_IN_LIST", { bundleId: stored.id, status: stored.status });
    } else {
      otaLog("BUNDLE_NOT_IN_LIST", { fallbackId: bundle.id });
    }
  } catch (e: any) {
    otaLog("LIST_VERIFY_FAIL", { error: String(e) });
  }

  // Apply immediately via set() — reloads the WebView with the new bundle.
  // next() requires a true process cold-start (OS killing the process) which
  // most Android users never trigger; set() works regardless of how the app
  // was launched and is the only reliable activation path.
  setOtaProgress(100);
  setOtaDone(true);
  otaLog("SET_PENDING", { bundleId: bundleIdForNext, version: manifest.version });

  // Brief pause so the 100% progress bar is visible before the reload.
  await new Promise(r => setTimeout(r, 1500));

  try {
    await CapacitorUpdater.set({ id: bundleIdForNext });
    // If set() succeeds the WebView reloads immediately — code below never runs.
    otaLog("SET_OK", { bundleId: bundleIdForNext, version: manifest.version });
  } catch (e: any) {
    console.warn("[OTA] set() failed:", e);
    otaLog("SET_FAIL", { error: String(e), bundleId: bundleIdForNext });
    setOtaProgress(null);
    setOtaDone(false);
  }
}

/**
 * OTA update hook — must be the first hook in the root page component,
 * before any early returns, so the module-level notifyAppReady runs ASAP.
 */
export function useOtaUpdater(): void {
  useEffect(() => {
    runOtaUpdate();
  }, []);
}
