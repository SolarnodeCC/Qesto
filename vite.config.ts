import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { theme as generatedTheme } from './src/ui/tailwind-theme'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { loadEnv } from 'vite'

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

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '')
    if (!env.VITE_API_BASE_URL) {
      throw new Error('Missing VITE_API_BASE_URL for production build. Configure it in the Pages Production environment variables.')
    }
  }

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
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      environmentMatchGlobs: [
        // a11y tests run in jsdom so axe-core can access a real DOM API
        ['tests/a11y/**', 'jsdom'],
      ],
      coverage: {
        provider: 'v8',
        reporter: ['json', 'text', 'html'],
        include: ['functions/**/*.ts', 'src/**/*.tsx'],
        exclude: ['dist/**', 'node_modules/**', 'scripts/**', 'tests/**', '**/*.test.ts', '**/*.test.tsx'],
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
        // Category-specific thresholds
        all: {
          lines: 85,
          functions: 85,
          branches: 75,
          statements: 85,
        },
        // Thresholds by path pattern
        perFile: true,
        skipFull: true,
      },
    },
    // Extend Tailwind config with auto-generated theme from design tokens
    // This is only used for CSS generation and does not affect the vite config directly,
    // but we import it here to ensure it's generated before build
    __generatedTheme: generatedTheme,
  }
})
