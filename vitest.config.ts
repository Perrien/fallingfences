import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts: the parity tests are pure TypeScript (no .svelte
// imports), so they don't need the Svelte/PWA plugins — and keeping the two configs apart
// avoids a type clash between vitest's bundled Vite and the top-level Vite.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
