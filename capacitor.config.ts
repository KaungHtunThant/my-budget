import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kaunghtunthant.mybudget',
  appName: 'My Budget',
  webDir: 'dist',
  android: {
    // Prototype stage: no network features yet, so no cleartext traffic needed.
    allowMixedContent: false,
  },
}

export default config
