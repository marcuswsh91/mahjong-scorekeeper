import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages serves the app under /mahjong-scorekeeper/; `npm run deploy` sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // Offline + install to home screen. The service worker precaches the whole built app,
    // so after one visit it runs with no signal. Service workers need HTTPS (or localhost).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: '台麻計分 Mahjong score keeper',
        short_name: '台麻計分',
        description: 'Taiwanese 16-tile mahjong score keeper',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14532d',
        theme_color: '#14532d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png}'] },
    }),
  ],
  server: { host: true }, // reachable from a phone on the same Wi-Fi
});
