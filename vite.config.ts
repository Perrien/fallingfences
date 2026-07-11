/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Served from GitHub Pages under /fallingfences/ — base, scope, and start_url must
// all agree or assets 404. See WebPWAPortPlan.md "Deploy".
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
        theme_color: '#1a1a1c',
        background_color: '#1a1a1c',
        display: 'standalone',
        scope: '/fallingfences/',
        start_url: '/fallingfences/',
        // Icons are added in a later phase (reuse the Swift AppIcon PNGs).
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
