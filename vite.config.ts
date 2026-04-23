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
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/api\.rivers\.run\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'api-metadata-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
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
        },
        {
          urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/rivers-run\.appspot\.com\/o\/public%2F(rivers|gauges)\.json/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'flow-data-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 7 // Keep for up to a week just in case of long offline
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/rivers\.run\/riverdata\.json$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'river-data-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 30 // Keep static river data for up to a month
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          // Tier 1: Permanent Basemaps (Zoom 0-8)
          // No expiration age, large limit to protect manual downloads.
          urlPattern: /^https:\/\/tile\.openstreetmap\.org\/([0-8])\//i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'map-tiles-permanent',
            expiration: {
              maxEntries: 15000,
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          // Tier 2: Regional Maps (Zoom 9-12)
          // 30-day rotation for automated browsing.
          urlPattern: /^https:\/\/tile\.openstreetmap\.org\/(9|1[0-2])\//i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'map-tiles-regional',
            expiration: {
              maxEntries: 2000,
              maxAgeSeconds: 60 * 60 * 24 * 30
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          // Tier 3: Detailed Spots (Zoom 13+)
          // 7-day aggressive rotation for detailed river spots.
          urlPattern: /^https:\/\/tile\.openstreetmap\.org\/(1[3-9]|2[0-9])\//i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'map-tiles-detailed',
            expiration: {
              maxEntries: 500,
              maxAgeSeconds: 60 * 60 * 24 * 7
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
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
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  test: {
    globals: true,
    environment: 'happy-dom', // Better for React/DOM testing than plain node
    exclude: ['node_modules', 'dist', '.git', 'api', 'api-flow', 'functions', 'tests'],
  },
})