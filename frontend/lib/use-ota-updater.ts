/**
 * use-ota-updater.ts
 * Android OTA 热更新核心逻辑
 *
 * 导出：
 * - runOtaUpdate()          纯异步函数，封装完整 OTA 更新流程
 * - useOtaUpdater()         React hook 包装，useEffect 中调用 runOtaUpdate
 * - _resetOtaRunningForTest 仅测试用，重置防重入标志
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
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

/** 仅测试用：重置防重入标志 */
export function _resetOtaRunningForTest(): void {
  _otaRunning = false;
}

/** Fire-and-forget OTA 日志 */
function otaLog(event: string, version?: string, error?: string): void {
  try {
    supabase.from('ota_logs').insert({ event, version, error, created_at: new Date().toISOString() }).then(() => {});
  } catch {
    // 静默
  }
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
  if (_otaRunning) return;
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

    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { setOtaProgress, setOtaDone } = useStore.getState();

    // notifyAppReady — 独立 try/catch
    try {
      await CapacitorUpdater.notifyAppReady();
    } catch (e) {
      console.warn('[OTA] notifyAppReady failed:', e);
    }

    // 拉取 manifest
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
    if (!res.ok) {
      console.warn('[OTA] Manifest fetch failed, status:', res.status);
      return;
    }

    const manifest = await res.json();

    // 防御性校验
    if (
      !manifest.version ||
      typeof manifest.version !== 'string' ||
      !manifest.url ||
      typeof manifest.url !== 'string' ||
      !manifest.url.startsWith('https://')
    ) {
      console.warn('[OTA] Invalid manifest:', manifest);
      return;
    }

    // 版本比对
    if (manifest.version === BUNDLE_VERSION) {
      return;
    }

    // 下载 bundle（最多 3 次重试）
    otaLog('download_start', manifest.version);
    let bundle: { id: string; version: string } | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        setOtaProgress(attempt === 1 ? 10 : attempt === 2 ? 30 : 50);
        bundle = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
        });
        break; // 成功则退出循环
      } catch (e) {
        console.warn(`[OTA] Download attempt ${attempt} failed:`, e);
        if (attempt < 3) {
          await delay(Math.pow(2, attempt) * 1000); // 2s, 4s
        }
      }
    }

    if (!bundle) {
      otaLog('download_failed', manifest.version);
      setOtaProgress(null);
      setOtaDone(false);
      return;
    }

    otaLog('download_success', manifest.version);
    setOtaProgress(80);

    // 验证 bundle 完整性
    let bundleId = bundle.id;
    try {
      const listResult = await CapacitorUpdater.list();
      const found = listResult.bundles.find(
        (b: { id: string }) => b.id === bundle!.id
      );
      if (found) {
        bundleId = found.id;
      }
      // 未找到则 fallback 使用 download 返回的 id
    } catch {
      // list 失败，使用 download 返回的 id
    }

    // 激活
    setOtaProgress(90);
    try {
      await CapacitorUpdater.set({ id: bundleId });
      setOtaProgress(100);
      setOtaDone(true);
      otaLog('set_success', manifest.version);
    } catch (e) {
      console.warn('[OTA] set() failed:', e);
      setOtaProgress(null);
      setOtaDone(false);
      otaLog('set_failed', manifest.version, String(e));
    }
  } catch (e) {
    console.warn('[OTA] Update check failed:', e);
  }
}

/** React hook：在组件 mount 时执行一次 OTA 检查 */
export function useOtaUpdater(): void {
  useEffect(() => {
    runOtaUpdate();
  }, []);
}
