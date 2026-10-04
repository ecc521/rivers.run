import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      'cloudflare:sockets': fileURLToPath(new URL('./src/__tests__/helpers/cloudflareSockets.ts', import.meta.url)),
      'cloudflare:workers': fileURLToPath(new URL('./src/__tests__/helpers/cloudflareWorkers.ts', import.meta.url)),
    },
  },
});
