import type { CapacitorConfig } from '@capacitor/cli'

/**
 * NATIVE-SHELL-01 — Capacitor wraps the Vite `dist/` bundle (ADR-0042 / ADR-0044).
 * Run: npm run build && npx cap sync
 */
const config: CapacitorConfig = {
  appId: 'cc.qesto.app',
  appName: 'Qesto',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
