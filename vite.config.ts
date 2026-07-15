import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: 'auto',
    // Disable SW in development so we don't trip over aggressive caching
    devOptions: {
      enabled: false,
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,pmtiles,json,woff2}'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      runtimeCaching: [
        // Explicit allowlist, not a wildcard — Workbox caches by URL only (ignores
        // Authorization), so a blanket rule would silently cache auth-gated/live
        // endpoints too. Everything not listed here falls through to the network;
        // the API also sends its own Cache-Control as a second layer of defense.
        {
          urlPattern: /^https:\/\/api\.rivers\.run\/rivers(\?.*)?$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'rivers-metadata-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 // mirrors the server's stale-while-revalidate=86400
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        // No rule for /rivers/{id} — its only consumer (RiverEditor) needs guaranteed-
        // current data, so it bypasses the worker; the API sends `must-revalidate`.
        {
          // Prefer live data, but don't hang on a bad-but-connected network (lie-fi) —
          // fall back to cache after 2s while the live fetch keeps running in the background.
          urlPattern: /^https:\/\/api\.rivers\.run\/community\/lists(\?.*)?$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'community-lists-cache',
            networkTimeoutSeconds: 2,
            expiration: {
              maxEntries: 3,
              maxAgeSeconds: 60 * 60 * 24 // mirrors the server's stale-while-revalidate=86400
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          // /lists/{id} is public (the ID is the sharing capability) — unlike bare
          // /lists, which is auth-gated "my lists" and stays no-store (see api/src/index.ts).
          urlPattern: /^https:\/\/api\.rivers\.run\/lists\/[^/]+(\?.*)?$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'lists-detail-cache',
            networkTimeoutSeconds: 2,
            expiration: {
              maxEntries: 30,
              maxAgeSeconds: 60 * 60 * 24 // mirrors the server's stale-while-revalidate=86400
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/flow\.rivers\.run\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'flow-data-cache-v2',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 60 * 24 // 1 day
            },
            broadcastUpdate: {
              channelName: 'flow-data-updates',
              options: {}
            }
          }
        }
        // (Removed dead rules for firebasestorage.googleapis.com and riverdata.json —
        // neither is used or referenced anywhere in this app.)
      ]
    },
    manifest: {
      name: 'Rivers.run',
      short_name: 'Rivers.run',
      description: 'Every River at your Fingertips!',
      theme_color: '#317EFB',
      background_color: '#317EFB',
      display: 'standalone',
      prefer_related_applications: true,
      related_applications: [
          {
              platform: "play",
              url: "https://play.google.com/store/apps/details?id=run.rivers.twa",
              id: "run.rivers.twa"
          }
      ],
      icons: [
        {
          src: '/icons/icon-72.webp',
          sizes: '72x72',
          type: 'image/webp'
        },
        {
          src: '/icons/icon-96.webp',
          sizes: '96x96',
          type: 'image/webp'
        },
        {
          src: '/icons/icon-128.webp',
          sizes: '128x128',
          type: 'image/webp'
        },
        {
          src: '/icons/icon-192.webp',
          sizes: '192x192',
          type: 'image/webp'
        },
        {
          src: '/icons/icon-256.webp',
          sizes: '256x256',
          type: 'image/webp'
        },
        {
          src: '/icons/icon-512.webp',
          sizes: '512x512',
          type: 'image/webp'
        }
      ]
    }
  }), process.env.VITEST ? null : cloudflare()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'iife',
  },
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  test: {
    globals: true,
    environment: 'happy-dom', // Better for React/DOM testing than plain node
    exclude: ['node_modules', 'dist', '.git', 'api', 'api-flow', 'functions', 'tests'],
    // api/ and api-flow/ need `environment: 'node'` (they're Workers, not
    // DOM code) — a single Vitest run can't mix environments in one project,
    // so they're declared as separate projects here instead. This makes
    // `npm test` from the root genuinely cover all three workspaces in one
    // command/report, rather than relying on each CI step to remember to
    // `cd` into them separately.
    projects: [
      { extends: true, test: { name: 'web' } },
      'api/vitest.config.ts',
      'api-flow/vitest.config.ts',
    ],
  },
})