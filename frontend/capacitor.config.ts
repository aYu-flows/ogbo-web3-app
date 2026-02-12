import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ogbo.app',
  appName: 'OGBO',
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
  }
};

export default config;
