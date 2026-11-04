import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:'com.controlai.app',
  appName:'ControlAI',
  webDir:'dist',
  server:{androidScheme:'https'},
  plugins:{CapacitorSQLite:{androidIsEncryption:false, iosIsEncryption:false}},
};
export default config;
