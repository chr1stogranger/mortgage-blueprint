import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Mortgage Blueprint',
        short_name: 'Blueprint',
        description: 'The supercharged mortgage calculator by Xpert Home Lending',
        theme_color: '#050505',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['finance', 'business'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache JS, CSS, and assets — but NOT index.html
        // index.html must always be fetched fresh from the server so that
        // security headers (CSP, HSTS, etc.) are never served from stale cache
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        // Ensure index.html is always fetched from network
        navigateFallback: null,
        // Runtime caching for API calls and external resources
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          {
            // Cache FRED API rate data (refresh every hour)
            urlPattern: /^https:\/\/api\.stlouisfed\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fred-rates-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5
            }
          },
          {
            // Cache read-only API endpoints (rates, listings, pricepoint)
            // Exclude collab/auth endpoints — those must never be cached
            urlPattern: /^\/api\/(rates|listings|pricepoint|propertydetails)/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 5
            }
          },
          {
            // Cache Unsplash images (PricePoint photos)
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ],
  base: './',
})
