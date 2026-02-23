/**
 * Unit tests for lib/use-ota-updater.ts — runOtaUpdate()
 *
 * Tests the core OTA update logic in isolation (no React environment needed).
 * The @capgo/capacitor-updater plugin is mocked to avoid native bridge calls.
 */

// ─── Mock @capgo/capacitor-updater ──────────────────────────────────────────

const mockNotifyAppReady = jest.fn().mockResolvedValue({ bundle: { id: 'builtin', version: '1.0.0' } });
const mockDownload = jest.fn().mockResolvedValue({ id: 'bundle-abc', version: '1.0.1' });
const mockNext = jest.fn().mockResolvedValue({ id: 'bundle-abc', version: '1.0.1' });

jest.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: (...args: any[]) => mockNotifyAppReady(...args),
    download: (...args: any[]) => mockDownload(...args),
    next: (...args: any[]) => mockNext(...args),
  },
}));

// ─── Mock ota-version ────────────────────────────────────────────────────────

jest.mock('../ota-version', () => ({ BUNDLE_VERSION: '1.0.0' }));

// ─── Import SUT ──────────────────────────────────────────────────────────────

import { runOtaUpdate } from '../use-ota-updater';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setAndroidPlatform() {
  (global as any).window = {
    Capacitor: { getPlatform: () => 'android' },
  };
}

function clearWindow() {
  delete (global as any).window;
}

// Default manifest fetch mock (up-to-date version, no update needed)
function mockFetch(manifest: Record<string, unknown>) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    json: jest.fn().mockResolvedValue(manifest),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  clearWindow();
});

describe('runOtaUpdate', () => {

  // Test 1: Non-Android/non-Capacitor environment
  test('1. skips all logic on non-Android environment (no window.Capacitor)', async () => {
    // No window set — simulates plain browser without Capacitor
    await runOtaUpdate();

    expect(mockNotifyAppReady).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
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
    expect(mockNext).not.toHaveBeenCalled();
  });

  // Test 3: Android, version differs — download and schedule
  test('3. calls download and next when a newer version is available', async () => {
    setAndroidPlatform();
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });

    await runOtaUpdate();

    expect(mockNotifyAppReady).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledWith({
      url: 'https://example.com/bundle-1.0.1.zip',
      version: '1.0.1',
    });
    expect(mockNext).toHaveBeenCalledWith({ id: 'bundle-abc' });
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

  // Test 8: download() fails — next should not be called
  test('8. does not call next when download fails', async () => {
    setAndroidPlatform();
    mockDownload.mockRejectedValueOnce(new Error('Download timeout'));
    mockFetch({ version: '1.0.1', url: 'https://example.com/bundle-1.0.1.zip' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(runOtaUpdate()).resolves.toBeUndefined();
    expect(mockNext).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('[OTA] Download failed:', expect.any(Error));

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

});
