/**
 * Unit tests for lib/use-ota-updater.ts — runOtaUpdate()
 *
 * Tests the core OTA update logic in isolation (no React environment needed).
 * The @capgo/capacitor-updater plugin is mocked to avoid native bridge calls.
 */

// ─── Mock @capgo/capacitor-updater ──────────────────────────────────────────

const mockNotifyAppReady = jest.fn().mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
const mockDownload = jest.fn().mockResolvedValue({ id: 'bundle-abc', version: '1.0.1' });
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockList = jest.fn().mockResolvedValue({ bundles: [{ id: 'bundle-abc', version: '1.0.1', status: 'success' }] });
const mockAddListener = jest.fn().mockResolvedValue({ remove: jest.fn() });
const mockCurrent = jest.fn().mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
const mockReset = jest.fn().mockResolvedValue(undefined);

jest.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: (...args: any[]) => mockNotifyAppReady(...args),
    download: (...args: any[]) => mockDownload(...args),
    set: (...args: any[]) => mockSet(...args),
    list: (...args: any[]) => mockList(...args),
    addListener: (...args: any[]) => mockAddListener(...args),
    current: (...args: any[]) => mockCurrent(...args),
    reset: (...args: any[]) => mockReset(...args),
  },
}));

// ─── Mock ota-version ────────────────────────────────────────────────────────

jest.mock('../ota-version', () => ({ BUNDLE_VERSION: '1.0.0' }));

// ─── Mock supabaseClient (otaLog fire-and-forget) ────────────────────────────

jest.mock('../supabaseClient', () => ({
  supabase: {
    from: () => ({ insert: () => ({ then: () => {} }) }),
  },
}));

// ─── Mock zustand store ──────────────────────────────────────────────────────

const mockSetOtaProgress = jest.fn();
const mockSetOtaDone = jest.fn();

jest.mock('../store', () => ({
  useStore: {
    getState: () => ({
      setOtaProgress: mockSetOtaProgress,
      setOtaDone: mockSetOtaDone,
    }),
  },
}));

// ─── Import SUT ──────────────────────────────────────────────────────────────

import { runOtaUpdate, _resetOtaRunningForTest } from '../use-ota-updater';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setAndroidPlatform() {
  (global as any).window = {
    Capacitor: { getPlatform: () => 'android' },
  };
}

function clearWindow() {
  delete (global as any).window;
}

// Default manifest fetch mock
function mockFetch(manifest: Record<string, unknown>) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    status: 200,
    ok: true,
    url: 'https://ogbox-web3-app.vercel.app/ota-manifest.json',
    json: jest.fn().mockResolvedValue(manifest),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Restore default mock implementations (clearAllMocks wipes them)
  mockNotifyAppReady.mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
  mockDownload.mockResolvedValue({ id: 'bundle-abc', version: '1.0.1' });
  mockSet.mockResolvedValue(undefined);
  mockList.mockResolvedValue({ bundles: [{ id: 'bundle-abc', version: '1.0.1', status: 'success' }] });
  mockAddListener.mockResolvedValue({ remove: jest.fn() });
  mockCurrent.mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
  mockReset.mockResolvedValue(undefined);

  jest.clearAllMocks();

  // Re-apply default implementations after clearAllMocks
  mockNotifyAppReady.mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
  mockDownload.mockResolvedValue({ id: 'bundle-abc', version: '1.0.1' });
  mockSet.mockResolvedValue(undefined);
  mockList.mockResolvedValue({ bundles: [{ id: 'bundle-abc', version: '1.0.1', status: 'success' }] });
  mockAddListener.mockResolvedValue({ remove: jest.fn() });
  mockCurrent.mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
  mockReset.mockResolvedValue(undefined);

  clearWindow();
  _resetOtaRunningForTest();
  // Replace setTimeout with immediate executor to skip all delay waits
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any; });
});

describe('runOtaUpdate', () => {

  // Test 1: Non-Android/non-Capacitor environment
  test('1. skips all logic on non-Android environment (no window.Capacitor)', async () => {
    // No window set — simulates plain browser without Capacitor
    await runOtaUpdate();

    expect(mockNotifyAppReady).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  test('1b. skips all logic on iOS platform', async () => {
    (global as any).window = {
      Capacitor: { getPlatform: () => 'ios' },
    };
    await runOtaUpdate();

    expect(mockNotifyAppReady).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  // Test 2: Android, version matches — no update
  test('2. calls notifyAppReady but skips download when version matches', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.0', url: 'https://example.com/bundle-1.0.0.zip' });

    await runOtaUpdate();

    expect(mockNotifyAppReady).toHaveBeenCalledTimes(1);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  // Test 3: Android, version differs — download and activate via set()
  test('3. calls download and set() when a newer version is available', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });

    await runOtaUpdate();

    expect(mockNotifyAppReady).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'https://example.com/bundle-1.0.1.zip',
      version: '1.0.1',
    });
    // set() should be called with the bundle ID from list() verification
    expect(mockSet).toHaveBeenCalledWith({ id: 'bundle-abc' });
  });

  // Test 4: fetch throws network error
  test('4. silently handles fetch network error without throwing', async () => {
    setAndroidPlatform();
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runOtaUpdate()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OTA]'),
      expect.any(Error)
    );
    expect(mockDownload).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // Test 5: manifest JSON is invalid
  test('5. silently handles invalid manifest JSON without throwing', async () => {
    setAndroidPlatform();
    (global as any).fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      url: 'https://ogbox-web3-app.vercel.app/ota-manifest.json',
      json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runOtaUpdate()).resolves.toBeUndefined();
    expect(mockDownload).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // Test 6: manifest.version is null/undefined
  test('6. does not trigger download when manifest.version is missing', async () => {
    setAndroidPlatform();
    mockFetch({ url: 'https://example.com/bundle.zip' }); // missing version
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runOtaUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[OTA] Invalid manifest:', expect.anything());

    warnSpy.mockRestore();
  });

  // Test 7: notifyAppReady throws — should not break the rest
  test('7. continues update check even when notifyAppReady throws', async () => {
    setAndroidPlatform();
    mockNotifyAppReady.mockRejectedValueOnce(new Error('bridge error'));
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runOtaUpdate();

    expect(warnSpy).toHaveBeenCalledWith('[OTA] notifyAppReady failed:', expect.any(Error));
    // Download should still proceed
    expect(mockDownload).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  // Test 8: download() fails all 3 attempts — set() should not be called
  // setTimeout is mocked to execute immediately, so retry delays are instant.
  test('8. does not call set() when all download attempts fail', async () => {
    setAndroidPlatform();
    mockDownload.mockRejectedValue(new Error('Download timeout'));
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runOtaUpdate();

    expect(mockSet).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[OTA] Download attempt'),
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });

  // Test 9: manifest.url does not start with https://
  test('9. rejects non-https manifest URL and skips download', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.1', url: 'http://example.com/bundle.zip' }); // HTTP, not HTTPS
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runOtaUpdate();

    expect(mockDownload).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[OTA] Invalid manifest:', expect.anything());

    warnSpy.mockRestore();
  });

  // Test 10: set() fails — progress should be reset
  // setTimeout is mocked to execute immediately, so delays are instant.
  test('10. resets progress state when set() throws', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });
    mockSet.mockRejectedValueOnce(new Error('Bundle does not exist'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await runOtaUpdate();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSetOtaProgress).toHaveBeenLastCalledWith(null);
    expect(mockSetOtaDone).toHaveBeenLastCalledWith(false);
    expect(warnSpy).toHaveBeenCalledWith('[OTA] set() failed:', expect.any(Error));

    warnSpy.mockRestore();
  });

  // Test 11: bundle not found in list() — falls back to download() ID
  test('11. falls back to download bundle ID when list() does not contain the bundle', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });
    // list() returns empty — bundle not found
    mockList.mockResolvedValueOnce({ bundles: [] });

    await runOtaUpdate();

    // Should still call set() with the original download ID as fallback
    expect(mockSet).toHaveBeenCalledWith({ id: 'bundle-abc' });
  });

});
