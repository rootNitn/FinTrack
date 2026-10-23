import type { CapacitorConfig } from '@capacitor/cli';

// `cap sync` always reads this static config, so the web build output directory must be
// selected via an env var matching whichever `ng build --configuration <name>` was run.
const webDir = process.env['LIFETRACK_ANDROID_WEB_DIR'] || 'dist/android-spike/browser';

const config: CapacitorConfig = {
  appId: 'com.lifetrack.app.spike',
  appName: 'LifeTrack Spike',
  loggingBehavior: 'none',
  webDir,
  server: { androidScheme: 'http' },
  plugins: {
    // Only Google Sign-In is used — disabling the rest keeps their native SDKs out of the APK.
    SocialLogin: { providers: { google: true, facebook: false, apple: false, twitter: false } },
  },
};

export default config;