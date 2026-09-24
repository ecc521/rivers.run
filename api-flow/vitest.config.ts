import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./src/__tests__/helpers/cloudflareWorkers.ts', import.meta.url)),
    },
  },
});
