import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: '/controlai/',
  plugins: [react(), VitePWA({registerType:'autoUpdate', includeAssets:['icon.svg'], manifest:{name:'ControlAI - Finanças',short_name:'ControlAI',description:'Controle financeiro offline',theme_color:'#17345b',background_color:'#f4f7fb',display:'standalone',start_url:'/controlai/',scope:'/controlai/',icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'/controlai/index.html',globPatterns:['**/*.{js,css,html,svg,png,ico}']}})]
});
