const { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');

const adb = 'C:/Users/verma/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const serial = 'emulator-5554';
const debugUrl = 'http://127.0.0.1:9222';
const apk = 'C:/Users/verma/Documents/my project/frontend/android/app/build/outputs/apk/debug/app-debug.apk';

function adbRun(args) {
  return execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function connectWebView() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const response = await fetch(`${debugUrl}/json/version`);
      if (response.ok) return await chromium.connectOverCDP(debugUrl);
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('devtools endpoint unavailable');
}

async function main() {
  adbRun(['install', '-r', apk]);
  adbRun(['shell', 'am', 'force-stop', 'com.lifetrack.app.spike']);
  adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
  let pid = '';
  for (let attempt = 0; attempt < 30 && !pid; attempt++) {
    try { pid = adbRun(['shell', 'pidof', 'com.lifetrack.app.spike']); } catch {}
    if (!pid) await new Promise(r => setTimeout(r, 1000));
  }
  adbRun(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
  const browser = await connectWebView();
  const page = browser.contexts()[0].pages()[0];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`); });

  await page.waitForFunction(() => !!document.querySelector('app-root') && !!window.Capacitor?.nativePromise, undefined, { timeout: 30000 });
  await page.evaluate(async () => {
    await window.Capacitor.nativePromise('SessionVault', 'clear', {});
    location.replace('/auth/login');
  });
  await page.locator('input[type="email"]').waitFor({ timeout: 30000 });
  console.log('PASS: login page loaded');

  const googleButton = page.getByRole('button', { name: 'Continue with Google', exact: true });
  await googleButton.waitFor({ timeout: 15000 });
  console.log('PASS: native "Continue with Google" button rendered (not the web GSI iframe)');

  pageErrors.length = 0;
  await googleButton.click();
  // Credential Manager has no accounts/is misconfigured in this throwaway emulator image, so we
  // expect a graceful nativeError() message, NOT an uncaught exception/crash.
  await page.waitForFunction(() => {
    const btn = document.querySelector('app-google-sign-in-button');
    return btn?.textContent?.includes('Continue with Google');
  }, undefined, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const errorText = await page.locator('app-google-sign-in-button p').textContent().catch(() => null);
  console.log(`Native sign-in tap result (expected to fail gracefully, no emulator Google account): ${errorText ?? '(no error text found)'}`);
  if (pageErrors.length) {
    console.log(`FAIL: uncaught page errors after tapping Google button: ${pageErrors.join(' | ')}`);
  } else {
    console.log('PASS: no uncaught JS exceptions after tapping native Google Sign-In button');
  }

  await browser.close().catch(() => {});
}

main().catch(error => { console.error('FAILED:', error.message); process.exitCode = 1; });
