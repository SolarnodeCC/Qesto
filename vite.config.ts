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
      '/api': 'http://localhost:8788',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['dist/**', 'node_modules/**', 'scripts/**'],
    },
  },
  // Extend Tailwind config with auto-generated theme from design tokens
  // This is only used for CSS generation and does not affect the vite config directly,
  // but we import it here to ensure it's generated before build
  __generatedTheme: generatedTheme,
})
