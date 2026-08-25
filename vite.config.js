import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  test: {
    // Parallel Claude sessions leave git worktrees under .claude/worktrees/;
    // their duplicated test files resolve assets from the wrong root and fail.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
  build: {
    // ── Performance: code splitting + minification ──
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip chatty console output from production builds (CIO audit L-3):
        // logs can leak scenario/PII context and add noise. console.error is
        // KEPT deliberately — live error output has earned its place here
        // (stale-bundle debugging) and Sentry doesn't capture console.
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        drop_console: false,
        passes: 2,
      },
      mangle: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Mortgage Blueprint',
        short_name: 'Blueprint',
        description: 'The supercharged mortgage calculator by Xpert Home Lending',
        theme_color: '#0a1120',
        background_color: '#0a1120',
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
        globPatterns: ['**/*.{js,mjs,css,ico,png,svg,woff,woff2}'],
        // Ensure index.html is always fetched from network
        navigateFallback: null,
        // Purge precaches left behind by OLD service-worker versions.
        // Early SW builds precached index.html (with its response headers,
        // including CSP) — borrowers who installed those builds were served a
        // stale CSP that blocked the share flow. cleanupOutdatedCaches deletes
        // those old precache buckets the moment the new SW activates.
        cleanupOutdatedCaches: true,
        // Take control immediately on update — don't leave a stale SW driving
        // open tabs until every tab is closed.
        skipWaiting: true,
        clientsClaim: true,
        // Runtime caching for API calls and external resources
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              // v2: bumped 2026-07-17 so installed clients drop the year-old JetBrains
              // cache and fetch Geist Mono (CacheFirst would otherwise pin the old font).
              cacheName: 'google-fonts-cache-v2',
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
            // Exclude collab/auth/share endpoints — those must never be cached.
            // NOTE: workbox tests urlPattern against the FULL URL (with origin),
            // so the old /^\/api\/.../ anchor never matched — this rule was dead
            // code. Unanchored pathname match fixes it.
            urlPattern: /\/api\/(rates|listings|pricepoint|propertydetails)/i,
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
