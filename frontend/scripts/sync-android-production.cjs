// `cap sync` reads capacitor.config.ts's static webDir at the time it runs, so the production
// web build output must be selected via an env var rather than a shell-specific `set`/`export`.
const { execFileSync } = require('node:child_process');

const webDir = process.argv[2] || 'dist/android-production/browser';
const env = { ...process.env, LIFETRACK_ANDROID_WEB_DIR: webDir };
execFileSync('npx', ['cap', 'sync', 'android'], { stdio: 'inherit', shell: true, env });
