import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/controlai/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'ControlAI - Controle Financeiro',
        short_name: 'ControlAI',
        description: 'Controle financeiro pessoal offline',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/controlai/',
        scope: '/controlai/',
        icons: [
          {
            src: '/controlai/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/controlai/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
