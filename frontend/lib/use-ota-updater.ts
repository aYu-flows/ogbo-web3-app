/**
 * use-ota-updater.ts
 * Android OTA 热更新核心逻辑（诊断模式）
 *
 * 导出：
 * - runOtaUpdate()          纯异步函数，封装完整 OTA 更新流程
 * - useOtaUpdater()         React hook 包装，useEffect 中调用 runOtaUpdate
 * - _resetOtaRunningForTest 仅测试用，重置防重入标志
 */

declare global {
  interface Window {
    Capacitor?: {
      getPlatform?: () => string;
    };
  }
}

import { useEffect } from 'react';
import { BUNDLE_VERSION } from './ota-version';
import { supabase } from './supabaseClient';
import { useStore } from './store';

const MANIFEST_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ota-updates/ota-manifest.json`;

let _otaRunning = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 诊断日志系统 — 每条日志带序号、精确时间戳、分类
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _logSeq = 0;
const _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function diagLog(step: string, data?: Record<string, unknown>): void {
  _logSeq++;
  const payload = { ...data, _sid: _sessionId, _seq: _logSeq };
  // 同时 console.log 方便 logcat 调试
  console.log(`[OTA-DIAG #${_logSeq}] ${step}`, payload);
  try {
    supabase.from('ota_debug_log').insert({
      step,
      bundle_version: BUNDLE_VERSION,
      data: payload,
    }).then(() => {});
  } catch {
    // 静默
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 模块级 notifyAppReady() — 必须在 React 挂载前执行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android') {
  diagLog('MODULE_INIT', { platform: 'android', bundleVersion: BUNDLE_VERSION, href: window.location.href });
  import('@capgo/capacitor-updater').then(async ({ CapacitorUpdater }) => {
    // 先记录当前 bundle 状态（最关键的诊断信息）
    try {
      const cur = await (CapacitorUpdater as any).current();
      diagLog('MODULE_CURRENT', { current: cur });
    } catch (e) {
      diagLog('MODULE_CURRENT_FAIL', { error: String(e) });
    }

    try {
      const listResult = await CapacitorUpdater.list();
      diagLog('MODULE_LIST', {
        count: listResult.bundles.length,
        bundles: listResult.bundles.map((b: any) => ({
          id: b.id, version: b.version, status: b.status,
        })),
      });
    } catch (e) {
      diagLog('MODULE_LIST_FAIL', { error: String(e) });
    }

    try {
      await CapacitorUpdater.notifyAppReady();
      diagLog('MODULE_NOTIFY_OK');
    } catch (e) {
      diagLog('MODULE_NOTIFY_FAIL', { error: String(e) });
    }

    // 记录 WebView 路径信息
    try {
      const deviceId = await (CapacitorUpdater as any).getDeviceId?.();
      diagLog('MODULE_DEVICE', { deviceId });
    } catch {
      // 可能不存在此方法
    }
  }).catch((e) => {
    diagLog('MODULE_IMPORT_FAIL', { error: String(e) });
  });
}

/** 仅测试用：重置防重入标志 */
export function _resetOtaRunningForTest(): void {
  _otaRunning = false;
}

/** 延迟工具函数 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 核心 OTA 更新逻辑。
 * 仅在 Android Capacitor 环境执行，其他环境直接 return。
 */
export async function runOtaUpdate(): Promise<void> {
  // 防重入
  if (_otaRunning) {
    diagLog('RUN_SKIP_REENTRANT');
    return;
  }
  _otaRunning = true;

  try {
    // 平台门控
    if (
      typeof window === 'undefined' ||
      !window.Capacitor?.getPlatform ||
      window.Capacitor.getPlatform() !== 'android'
    ) {
      return;
    }

    diagLog('RUN_START', { href: window.location.href, bundleVersion: BUNDLE_VERSION });

    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { setOtaProgress, setOtaDone } = useStore.getState();

    // ── notifyAppReady（safety net，模块级已调用过一次）──
    try {
      await CapacitorUpdater.notifyAppReady();
      diagLog('RUN_NOTIFY_OK');
    } catch (e) {
      diagLog('RUN_NOTIFY_FAIL', { error: String(e) });
    }

    // ── 当前 bundle 状态 ──
    try {
      const cur = await (CapacitorUpdater as any).current();
      diagLog('RUN_CURRENT', { current: cur });
    } catch (e) {
      diagLog('RUN_CURRENT_FAIL', { error: String(e) });
    }

    // ── 拉取 manifest ──
    const manifestUrl = `${MANIFEST_URL}?t=${Date.now()}`;
    diagLog('MANIFEST_FETCH', { url: manifestUrl });

    const res = await fetch(manifestUrl);
    if (!res.ok) {
      diagLog('MANIFEST_FETCH_FAIL', { status: res.status, statusText: res.statusText });
      return;
    }

    const manifest = await res.json();
    diagLog('MANIFEST_OK', { manifest });

    // 防御性校验
    if (
      !manifest.version ||
      typeof manifest.version !== 'string' ||
      !manifest.url ||
      typeof manifest.url !== 'string' ||
      !manifest.url.startsWith('https://')
    ) {
      diagLog('MANIFEST_INVALID', { manifest });
      return;
    }

    // ── 版本比对 ──
    if (manifest.version === BUNDLE_VERSION) {
      diagLog('VERSION_MATCH', { version: BUNDLE_VERSION });
      return;
    }
    diagLog('VERSION_MISMATCH', { current: BUNDLE_VERSION, remote: manifest.version });

    // ── 下载 bundle ──
    let bundle: { id: string; version: string } | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        setOtaProgress(attempt === 1 ? 10 : attempt === 2 ? 30 : 50);
        diagLog('DOWNLOAD_START', { attempt, url: manifest.url, version: manifest.version });

        bundle = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
        });

        diagLog('DOWNLOAD_OK', { attempt, bundleId: bundle.id, bundleVersion: bundle.version });
        break;
      } catch (e) {
        diagLog('DOWNLOAD_FAIL', { attempt, error: String(e) });
        if (attempt < 3) {
          await delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    if (!bundle) {
      diagLog('DOWNLOAD_ALL_FAILED', { version: manifest.version });
      setOtaProgress(null);
      setOtaDone(false);
      return;
    }

    setOtaProgress(80);

    // ── 下载后 list() 验证 ──
    let bundleId = bundle.id;
    try {
      const listResult = await CapacitorUpdater.list();
      const allBundles = listResult.bundles.map((b: any) => ({
        id: b.id, version: b.version, status: b.status,
      }));
      diagLog('POST_DOWNLOAD_LIST', { count: listResult.bundles.length, bundles: allBundles });

      const found = listResult.bundles.find(
        (b: { id: string }) => b.id === bundle!.id
      );
      if (found) {
        bundleId = found.id;
        diagLog('BUNDLE_FOUND_IN_LIST', { bundleId, status: (found as any).status });
      } else {
        diagLog('BUNDLE_NOT_IN_LIST', { expectedId: bundle.id });
      }
    } catch (e) {
      diagLog('POST_DOWNLOAD_LIST_FAIL', { error: String(e) });
    }

    // ── 激活前状态快照 ──
    try {
      const curBefore = await (CapacitorUpdater as any).current();
      diagLog('PRE_SET_CURRENT', { current: curBefore });
    } catch (e) {
      diagLog('PRE_SET_CURRENT_FAIL', { error: String(e) });
    }

    // ── set() 激活 ──
    setOtaProgress(90);
    diagLog('SET_START', { bundleId });

    try {
      await CapacitorUpdater.set({ id: bundleId });
      // 注意：set() 后 WebView 可能立即 reload，以下代码可能不会执行
      setOtaProgress(100);
      setOtaDone(true);
      diagLog('SET_OK', { bundleId });
    } catch (e) {
      diagLog('SET_FAIL', { bundleId, error: String(e) });
      setOtaProgress(null);
      setOtaDone(false);
    }

    // ── set() 后状态快照（可能不会执行到这里）──
    try {
      const curAfter = await (CapacitorUpdater as any).current();
      diagLog('POST_SET_CURRENT', { current: curAfter });
    } catch (e) {
      diagLog('POST_SET_CURRENT_FAIL', { error: String(e) });
    }

  } catch (e) {
    diagLog('RUN_UNCAUGHT', { error: String(e), stack: (e as any)?.stack });
  }
}

/** React hook：在组件 mount 时执行一次 OTA 检查 */
export function useOtaUpdater(): void {
  useEffect(() => {
    runOtaUpdate();
  }, []);
}
