import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Served from GitHub Pages under /fallingfences/ — base, scope, and start_url must
// all agree or assets 404. See WebPWAPortPlan.md "Deploy". Test config is in vitest.config.ts.
export default defineConfig({
  base: '/fallingfences/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Falling Fences',
        short_name: 'Falling Fences',
        description: 'Safe manipulation simulation',
        theme_color: '#e4e4e8',
        background_color: '#e4e4e8',
        display: 'standalone',
        scope: '/fallingfences/',
        start_url: '/fallingfences/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
