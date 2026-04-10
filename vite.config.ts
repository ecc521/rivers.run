import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Disable SW in development so we don't trip over aggressive caching
      devOptions: {
        enabled: false,
      },
      workbox: {
        runtimeCaching: [
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
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst', // Aggressive caching since map tiles rarely change
            options: {
              cacheName: 'offline-map-tiles',
              expiration: {
                maxEntries: 5000, // Very healthy storage for maps
                maxAgeSeconds: 60 * 60 * 24 * 60 // 60 days
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
    })
  ],
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
})
