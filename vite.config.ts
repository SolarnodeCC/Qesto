import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { theme as generatedTheme } from './src/ui/tailwind-theme'
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
      sourcemap: true,
      target: 'es2022',
      rollupOptions: {
        output: {
          // Code-split vendor libraries for caching (Phase 10 Step 1)
          manualChunks: (id) => {
            // Split vendor libraries into separate chunks
            if (id.includes('node_modules')) {
              if (id.includes('react')) {
                return 'react-vendor'
              }
              if (id.includes('@tailwindcss') || id.includes('tailwindcss')) {
                return 'tailwind'
              }
              return 'vendor'
            }
          },
          // Optimize chunk size (>50kb triggers a warning)
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
      pool: 'threads',
      cache: { dir: 'node_modules/.vitest' },
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      environmentMatchGlobs: [
        // a11y tests run in jsdom so axe-core can access a real DOM API
        ['tests/a11y/**', 'jsdom'],
      ],
      coverage: {
        provider: 'v8',
        reporter: ['json', 'text', 'html'],
        reportsDirectory: './coverage',
        include: ['functions/**/*.ts', 'src/**/*.tsx'],
        exclude: ['dist/**', 'node_modules/**', 'scripts/**', 'tests/**', '**/*.test.ts', '**/*.test.tsx'],
        skipFull: true,
        // Regression FLOOR — set just below current project coverage so the
        // numbers can only ratchet UP. The long-term target is 85/85/75/85;
        // raise these as coverage grows.
        // NOTE: under vitest v4 thresholds MUST live here, inside `thresholds`.
        // The previous top-level `lines: 85` keys were in the v3 location and
        // were silently ignored (coverage was ~31% with a green build).
        thresholds: {
          statements: 29,
          branches: 19,
          functions: 24,
          lines: 30,
        },
      },
    },
    // Extend Tailwind config with auto-generated theme from design tokens
    // This is only used for CSS generation and does not affect the vite config directly,
    // but we import it here to ensure it's generated before build
    __generatedTheme: generatedTheme,
  }
})
