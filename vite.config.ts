import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({mode}) => ({
  base: mode === 'native' ? '/' : '/controlai/',
  plugins: [react(), VitePWA({
    disable: mode === 'native',
    registerType: 'autoUpdate',
    includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/brand-mark.png'],
    manifest: { name: 'ControlAI - Controle Financeiro', short_name: 'ControlAI', description: 'Controle financeiro offline', theme_color: '#0b1a2c', background_color: '#f2f5f4', display: 'standalone', start_url: '/controlai/', scope: '/controlai/', icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }
  })]
}));
