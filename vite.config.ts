import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { theme as generatedTheme } from './src/ui/tailwind-theme'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
