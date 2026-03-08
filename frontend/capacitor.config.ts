import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ogbo.app',
  appName: 'OGBOX',
  webDir: 'out',
  server: {
    androidScheme: 'https',  // Changed back to https for better compatibility
    hostname: 'localhost',
    cleartext: true,  // Allow cleartext for local content
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,  // Manual update mode: all update logic is handled in useOtaUpdater()
      appReadyTimeout: 30000,  // 30s timeout before plugin auto-rollback (default 10s too short for React hydration)
      resetWhenUpdate: false,  // Don't auto-reset on native app update
    }
  }
};

export default config;
