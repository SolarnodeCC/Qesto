import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

function getFrontendCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const frontendCommit = getFrontendCommit()
const frontendBuildTime = new Date().toISOString()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig(() => {
  // VITE_API_BASE_URL is optional: empty string means relative URLs (co-located Pages + Functions).
  // Set it explicitly only when the API lives on a different origin.

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __QESTO_FRONTEND_COMMIT__: JSON.stringify(frontendCommit),
      __QESTO_FRONTEND_BUILD_TIME__: JSON.stringify(frontendBuildTime),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@api': path.resolve(__dirname, './functions/api'),
      },
    },
    build: {
      outDir: 'dist',
      // DD-15: 'hidden' still EMITS .map files (upload them to an error tracker)
      // but omits the //# sourceMappingURL comment, so the browser never requests
      // them. Previously `true` published unminified source — comments, feature
      // flag names, plan-gating logic, unshipped functionality — to anyone, cached
      // `immutable` for a year via public/_headers.
      sourcemap: 'hidden',
      target: 'es2022',
      // Performance budget: warn in the build log when any chunk exceeds ~250 kB
      // (pre-gzip). Large chunks on the critical path delay LCP, so a visible
      // signal in CI keeps bundle growth honest.
      chunkSizeWarningLimit: 250,
      rollupOptions: {
        output: {
          // Code-split vendor libraries for caching (Phase 10 Step 1)
          manualChunks: (id) => {
            // Split vendor libraries into separate chunks
            if (id.includes('node_modules')) {
              // Match the package directory, not any path containing "react"
              // (which also caught react-router-dom, react-qr-code, and anything
              // else with the substring).
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                return 'react-vendor'
              }
              if (id.includes('@tailwindcss') || id.includes('tailwindcss')) {
                return 'tailwind'
              }
              return 'vendor'
            }
          },
          // Versioned, content-hashed chunk names for immutable long-term caching.
          chunkFileNames: 'chunks/[name]-[hash].js',
          entryFileNames: '[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: false,
          ws: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      setupFiles: ['tests/setup/rtl.ts'],
      environmentMatchGlobs: [
        // a11y tests run in jsdom so axe-core can access a real DOM API
        ['tests/a11y/**', 'jsdom'],
        // Component tests render real React trees (hooks, effects, events),
        // which needs a DOM. Everything else stays on `node` — it is faster,
        // and the API/unit tests have no use for one.
        ['tests/component/**', 'jsdom'],
      ],
      coverage: {
        provider: 'v8',
        reporter: ['json', 'text', 'html'],
        reportsDirectory: './coverage',
        // Measure the whole shipped surface. `src/**/*.ts` was missing until
        // RT-2026-09: 75 files / ~6.5k lines — including the WebSocket client
        // `src/hooks/useLiveSession.ts` — were excluded from the denominator,
        // so the headline number flattered the least-tested part of the app.
        include: ['functions/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
        exclude: ['dist/**', 'node_modules/**', 'scripts/**', 'tests/**', '**/*.test.ts', '**/*.test.tsx'],
        skipFull: true,
        // Regression FLOOR — set just below current project coverage so the
        // numbers can only ratchet UP. The long-term target is 85/85/75/85;
        // raise these as coverage grows.
        // NOTE: under vitest v4 thresholds MUST live here, inside `thresholds`.
        // The previous top-level `lines: 85` keys were in the v3 location and
        // were silently ignored (coverage was ~31% with a green build).
        // Measured 2026-09 under the corrected `include` above, after the
        // component lane landed: 42.51 stmt / 31.07 branch / 38.18 func /
        // 43.87 line. Each floor sits one point under the measurement, so
        // today's slack cannot be spent silently. Long-term target is
        // 85/85/75/85; raise these as coverage grows — never lower one to
        // make a build pass.
        thresholds: {
          statements: 41,
          branches: 30,
          functions: 37,
          lines: 42,
        },
      },
    },
  }
})
