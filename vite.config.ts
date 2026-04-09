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
            urlPattern: /^https:\/\/rivers\.run\/flowdata3\.json$/i,
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
        icons: [
          {
            src: 'resources/icons/144x144-Water-Drop.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: 'resources/icons/152x152-Water-Drop.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'resources/icons/180x180-Water-Drop.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: 'resources/icons/512x512-Water-Drop.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
