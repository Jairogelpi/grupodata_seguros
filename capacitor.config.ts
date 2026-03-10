import type { CapacitorConfig } from '@capacitor/cli';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const appUrl = process.env.CAPACITOR_APP_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.grupodata.seguros',
  appName: 'Grupo Data Seguros',
  webDir: 'mobile-web',
  server: appUrl
    ? {
        url: appUrl,
        cleartext: appUrl.startsWith('http://'),
      }
    : undefined,
  android: {
    allowMixedContent: false,
  },
};

export default config;
