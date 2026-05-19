import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cjgerren.firepilottunnelrun',
  appName: 'FirePilot Tunnel Run',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
