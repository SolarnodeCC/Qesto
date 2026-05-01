import type { Config } from 'tailwindcss'
import { theme as generatedTheme } from './src/ui/tailwind-theme'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: generatedTheme,
  },
  plugins: [],
} satisfies Config
