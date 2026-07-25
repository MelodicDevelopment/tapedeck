import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Fail loudly instead of auto-incrementing onto a neighboring app's port
    // (Envy proxies other products' domains to fixed localhost ports).
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    server: {
      deps: {
        // The package's internal directory imports (./bootstrap etc.) need
        // Vite's resolver; Node's native ESM loader rejects them.
        inline: ['@melodicdev/core'],
      },
    },
  },
})
