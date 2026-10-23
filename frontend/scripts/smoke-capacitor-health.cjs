const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const http = require('node:http');
const { chromium } = require('@playwright/test');

const adb = 'C:/Users/verma/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const apk = 'C:/Users/verma/Documents/my project/frontend/android/app/build/outputs/apk/debug/app-debug.apk';
const writerApk = 'C:/Users/verma/Documents/my project/android-companion/app/build/outputs/apk/debug/app-debug.apk';
const api = 'http://localhost:4000/api/v1';
const serial = process.env['ANDROID_SERIAL'] || 'emulator-5554';
const debugUrl = process.env['CAPACITOR_CDP_URL'] || 'http://127.0.0.1:9222';
const uiOnly = process.argv.includes('--ui-only');
const healthSourceOnly = process.argv.includes('--health-source-only');
const fdPortfolioOnly = process.argv.includes('--fd-portfolio-only');
const mutualFundsOnly = process.argv.includes('--mutual-funds-only');
const processDeathSmoke = process.argv.includes('--kill-process');
const processRebootSmoke = process.argv.includes('--reboot');
const refreshRaceSmoke = process.argv.includes('--refresh-race');
const strictRefreshRaceSmoke = process.argv.includes('--strict-refresh-race');
const accountSwitchRaceSmoke = process.argv.includes('--account-switch-race');
const logoutRaceSmoke = process.argv.includes('--logout-race') || accountSwitchRaceSmoke;
const launchAfterReboot = process.argv.includes('--launch-after-reboot');
const skipInstall = process.argv.includes('--skip-install');
const recoverySmoke = processDeathSmoke || processRebootSmoke;
const backgroundSmoke = process.env['LIFETRACK_BACKGROUND_SMOKE'] === '1' || process.argv.includes('--background') || recoverySmoke || refreshRaceSmoke || strictRefreshRaceSmoke || logoutRaceSmoke;
const email = `cap-health-${crypto.randomUUID()}@example.invalid`;
const password = `Test@${crypto.randomBytes(8).toString('hex')}A1`;
const accountSwitchEmail = `cap-health-switch-${crypto.randomUUID()}@example.invalid`;
const accountSwitchPassword = `Test@${crypto.randomBytes(8).toString('hex')}A1`;
const cleanupAccessTokens = [];
let browser;
let testPage;
let pageErrors = [];
let connectionId;
let initialRefreshToken;
let writerRecordExists = false;
let emulatorNetworkDisabled = false;
let workerRefreshProxy;

function startHeldRefreshProxy() {
  let resolveRefreshSeen;
  let resolveRefreshStatus;
  let resolveSecondRefreshStatus;
  let releaseRefresh;
  const refreshSeen = new Promise(resolve => { resolveRefreshSeen = resolve; });
  const refreshStatus = new Promise(resolve => { resolveRefreshStatus = resolve; });
  const secondRefreshStatus = new Promise(resolve => { resolveSecondRefreshStatus = resolve; });
  const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  const refreshTokens = [];
  let refreshResponseCount = 0;
  const server = http.createServer((request, response) => {
    const body = [];
    request.on('data', chunk => body.push(chunk));
    request.on('end', async () => {
      const isRefresh = request.url?.endsWith('/auth/refresh') === true;
      const requestBody = Buffer.concat(body);
      if (isRefresh) {
        resolveRefreshSeen();
        try { refreshTokens.push(JSON.parse(requestBody.toString('utf8')).refreshToken); }
        catch { refreshTokens.push(null); }
        await refreshGate;
      }
      const upstream = http.request({
        hostname: '127.0.0.1',
        port: 4000,
        method: request.method,
        path: request.url,
        headers: { ...request.headers, host: '127.0.0.1:4000' },
      }, upstreamResponse => {
        if (isRefresh) {
          const status = upstreamResponse.statusCode || 502;
          refreshResponseCount++;
          if (refreshResponseCount === 1) resolveRefreshStatus(status);
          if (refreshResponseCount === 2) resolveSecondRefreshStatus(status);
        }
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });
      upstream.on('error', () => {
        response.writeHead(502);
        response.end('Backend proxy failed');
      });
      upstream.end(requestBody);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not bind worker refresh proxy'));
      resolve({
        server,
        apiBaseUrl: `http://10.0.2.2:${address.port}/api/v1`,
        refreshSeen,
        refreshStatus,
        secondRefreshStatus,
        refreshTokens,
        release: releaseRefresh,
      });
    });
  });
}

function waitFor(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(message)), timeoutMs); }),
  ]).finally(() => clearTimeout(timeout));
}

function adbRun(args) {
  return execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function setEmulatorNetwork(enabled) {
  const action = enabled ? 'enable' : 'disable';
  adbRun(['shell', 'svc', 'wifi', action]);
  try { adbRun(['shell', 'svc', 'data', action]); }
  catch (error) {
    if (!String(error.message).includes("Can't find service: phone")) throw error;
  }
}

async function waitForAppPid() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const pid = adbRun(['shell', 'pidof', 'com.lifetrack.app.spike']);
      if (pid) return pid.split(/\s+/)[0];
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('LifeTrack app process did not start on the emulator');
}

async function waitForEmulatorBoot(timeoutSeconds = 180) {
  for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
    try {
      const devices = execFileSync(adb, ['devices'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (devices.split(/\r?\n/).some(line => line.startsWith(`${serial}\tdevice`)) && adbRun(['shell', 'getprop', 'sys.boot_completed']) === '1') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Emulator did not return online after reboot');
}

async function waitForScheduledHealthJob(timeoutSeconds = 30) {
  const service = 'com.lifetrack.app.spike/androidx.work.impl.background.systemjob.SystemJobService';
  for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
    if (adbRun(['shell', 'dumpsys', 'jobscheduler']).includes(service)) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('LifeTrack Health work was not registered with JobScheduler after app startup');
}

function parseAttributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) result[match[1]] = match[2];
  return result;
}

async function runWriterAction(buttonLabel, expectedStatus) {
  adbRun(['shell', 'am', 'force-stop', 'com.lifetrack.health']);
  adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.health/.HealthRecordTestWriterActivity']);
  let button;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      adbRun(['shell', 'uiautomator', 'dump', '/sdcard/lifetrack-writer-smoke.xml']);
      const xml = adbRun(['shell', 'cat', '/sdcard/lifetrack-writer-smoke.xml']);
      button = [...xml.matchAll(/<node\b[^>]*>/g)].map(match => parseAttributes(match[0]))
        .find(node => node.class === 'android.widget.Button' && node.text === buttonLabel);
      if (button) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  const bounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(button?.bounds || '');
  if (!bounds) throw new Error(`Health Connect test writer button was not found: ${buttonLabel}`);
  const x = Math.floor((Number(bounds[1]) + Number(bounds[3])) / 2);
  const y = Math.floor((Number(bounds[2]) + Number(bounds[4])) / 2);
  adbRun(['shell', 'input', 'tap', String(x), String(y)]);
  for (let attempt = 0; attempt < 30; attempt++) {
    adbRun(['shell', 'uiautomator', 'dump', '/sdcard/lifetrack-writer-smoke.xml']);
    const xml = adbRun(['shell', 'cat', '/sdcard/lifetrack-writer-smoke.xml']);
    const status = [...xml.matchAll(/<node\b[^>]*>/g)].map(match => parseAttributes(match[0]))
      .find(node => node.class === 'android.widget.TextView' && node.text?.startsWith(expectedStatus));
    if (status) return status.text;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Health Connect test writer did not report: ${expectedStatus}`);
}

async function getWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await fetch(url, options); }
    catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

async function waitForConnectedBackendNetwork(timeoutSeconds = 120) {
  for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
    const connectivity = adbRun(['shell', 'dumpsys', 'connectivity']);
    if (/^Active default network:\s*\d+/m.test(connectivity)) {
      try {
        adbRun(['shell', 'toybox', 'nc', '-z', '-w', '2', '10.0.2.2', '4000']);
        return;
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Emulator did not restore a default network route to the backend');
}

async function waitForNoDefaultNetwork(timeoutSeconds = 30) {
  for (let attempt = 0; attempt < timeoutSeconds; attempt++) {
    const connectivity = adbRun(['shell', 'dumpsys', 'connectivity']);
    if (!/^Active default network:\s*[1-9]\d*/m.test(connectivity)) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Emulator still has a default network after network disable');
}

async function backendDailySteps(accessToken) {
  const response = await getWithRetry(`${api}/health/daily?days=1`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Backend daily summary failed (${response.status})`);
  const result = (await response.json()).data;
  return result.days.find(day => day.date === result.today)?.steps ?? 0;
}

async function assertNoHorizontalOverflow(page, routeLabel) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  if (dimensions.content > dimensions.viewport + 1) {
    throw new Error(`${routeLabel} overflows the phone viewport (${dimensions.content}px > ${dimensions.viewport}px)`);
  }
}

async function openFinanceRoute(page, tabs, label, path) {
  await tabs.getByRole('button', { name: 'Finance' }).click();
  await page.getByRole('dialog', { name: 'Finance navigation' }).getByRole('link', { name: new RegExp(label, 'i') }).click();
  await page.waitForURL(`**${path}`);
}

async function exerciseGoalCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Goals', '/goals');
  const goalList = page.getByTestId('mobile-goal-list');
  const suffix = crypto.randomUUID().slice(0, 8);
  const originalName = `Android QA Goal ${suffix}`;
  const updatedName = `${originalName} Updated`;

  await page.getByRole('button', { name: 'Add Goal', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Goal' });
  await createDialog.locator('input[formcontrolname="name"]').fill(originalName);
  await createDialog.locator('input[formcontrolname="targetAmount"]').fill('5000');
  await createDialog.locator('input[formcontrolname="currentAmount"]').fill('1000');
  await createDialog.locator('input[formcontrolname="deadline"]').fill('12/30/2026');
  await createDialog.getByRole('button', { name: 'Add goal', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  let goalCard = goalList.locator('article').filter({ hasText: originalName });
  await goalCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Goal create');
  const goalEditTarget = await goalCard.getByRole('button', { name: `Edit ${originalName}` }).boundingBox();
  if (!goalEditTarget || goalEditTarget.width < 44 || goalEditTarget.height < 44) throw new Error('Goal edit target is smaller than 44px');

  await goalCard.getByRole('button', { name: `Add contribution to ${originalName}` }).click();
  const contributionDialog = page.getByRole('dialog', { name: 'Add Contribution' });
  await contributionDialog.locator('input[formcontrolname="amount"]').fill('250');
  await contributionDialog.locator('input[formcontrolname="note"]').fill(`Android QA contribution ${suffix}`);
  await contributionDialog.getByRole('button', { name: 'Add contribution', exact: true }).click({ force: true });
  await contributionDialog.waitFor({ state: 'detached' });
  goalCard = goalList.locator('article').filter({ hasText: originalName });
  await goalCard.waitFor();
  const goalCardText = (await goalCard.innerText()).replace(/[^0-9]/g, '');
  if (!goalCardText.includes('1250')) throw new Error(`Goal contribution was not reflected in progress: ${await goalCard.innerText()}`);

  await goalCard.getByRole('button', { name: `Edit ${originalName}` }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Goal' });
  await editDialog.locator('input[formcontrolname="name"]').fill(updatedName);
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
  await editDialog.waitFor({ state: 'detached' });
  goalCard = goalList.locator('article').filter({ hasText: updatedName });
  await goalCard.waitFor();
  await goalCard.getByRole('button', { name: `Delete ${updatedName}` }).click();
  const goalDeleteDialog = page.getByRole('dialog', { name: 'Delete goal' });
  await goalDeleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await goalCard.waitFor({ state: 'detached' });
  console.log('PASS: Goal create, edit and delete completed on the phone list');
}

async function exerciseInvestmentCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Investments', '/investments');
  const investmentList = page.getByTestId('mobile-investment-list');
  const suffix = crypto.randomUUID().slice(0, 8);
  const originalName = `Android QA Investment ${suffix}`;
  const updatedName = `${originalName} Updated`;

  await page.getByRole('button', { name: 'Add Investment', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Investment' });
  await createDialog.locator('input[formcontrolname="name"]').fill(originalName);
  await createDialog.locator('input[formcontrolname="principalAmount"]').fill('1250');
  await createDialog.locator('input[formcontrolname="currentValue"]').fill('1380');
  await createDialog.getByRole('button', { name: 'Add investment', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  let investmentCard = investmentList.locator('article').filter({ hasText: originalName });
  await investmentCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Investment create');
  const investmentEditTarget = await investmentCard.getByRole('button', { name: `Edit ${originalName}` }).boundingBox();
  if (!investmentEditTarget || investmentEditTarget.width < 44 || investmentEditTarget.height < 44) throw new Error('Investment edit target is smaller than 44px');

  await investmentCard.getByRole('button', { name: `Edit ${originalName}` }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Investment' });
  await editDialog.locator('input[formcontrolname="name"]').fill(updatedName);
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
  await editDialog.waitFor({ state: 'detached' });
  investmentCard = investmentList.locator('article').filter({ hasText: updatedName });
  await investmentCard.waitFor();
  await investmentCard.getByRole('button', { name: `Delete ${updatedName}` }).click();
  const investmentDeleteDialog = page.getByRole('dialog', { name: 'Delete investment' });
  await investmentDeleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await investmentCard.waitFor({ state: 'detached' });
  console.log('PASS: Investment create, edit and delete completed on the phone list');
}

async function exerciseExpenseCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Expenses', '/expenses');
  const expenseList = page.getByTestId('mobile-expense-list');
  const suffix = crypto.randomUUID().slice(0, 8);
  const originalDescription = `Android QA Expense ${suffix}`;
  const updatedDescription = `${originalDescription} Updated`;
  const otherDescription = `Android QA Food ${suffix}`;

  const addExpense = async (category, amount, description, attachReceipt = false) => {
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Expense' });
    await dialog.locator('mat-select[formcontrolname="category"]').click();
    await page.getByRole('option', { name: category, exact: true }).click();
    await dialog.locator('input[formcontrolname="amount"]').fill(String(amount));
    await dialog.locator('textarea[formcontrolname="description"]').fill(description);
    if (attachReceipt) {
      const scanning = dialog.getByText(/Scanning receipt/);
      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'phase4-receipt.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=', 'base64'),
      });
      await scanning.waitFor({ state: 'visible', timeout: 5000 });
      await scanning.waitFor({ state: 'detached', timeout: 30000 });
    }
    await dialog.getByRole('button', { name: 'Add expense', exact: true }).click({ force: true });
    await dialog.waitFor({ state: 'detached' });
  };

  await addExpense('OTHERS', 123.45, originalDescription);
  await addExpense('FOOD', 67.89, otherDescription);

  let expenseCard = expenseList.locator('article').filter({ hasText: originalDescription });
  let otherCard = expenseList.locator('article').filter({ hasText: otherDescription });
  await expenseCard.waitFor();
  await otherCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Expense create');

  await page.getByRole('link', { name: 'Home' }).click();
  await page.waitForURL('**/dashboard');
  await page.getByRole('heading', { name: 'Financial Snapshot' }).waitFor();
  const recentTransactions = page.locator('.glass-card').filter({ hasText: 'Recent Transactions' }).first();
  await recentTransactions.getByText(originalDescription).waitFor();
  await assertNoHorizontalOverflow(page, 'Dashboard recent activity');
  await openFinanceRoute(page, tabs, 'Expenses', '/expenses');
  const receiptDescription = `Android QA Receipt ${suffix}`;
  await addExpense('OTHERS', 88.25, receiptDescription, true);
  const receiptCard = expenseList.locator('article').filter({ hasText: receiptDescription });
  await receiptCard.waitFor();
  await receiptCard.locator('a[aria-label="View receipt"]').waitFor();
  await assertNoHorizontalOverflow(page, 'Receipt attachment');

  const categoryFilter = page.locator('app-list-filter-bar mat-form-field').filter({ hasText: 'Category' }).locator('mat-select');
  await categoryFilter.click();
  await page.getByRole('option', { name: 'OTHERS', exact: true }).click();
  await expenseCard.waitFor();
  await otherCard.waitFor({ state: 'detached' });

  await expenseCard.getByRole('button', { name: 'Edit OTHERS expense' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Expense' });
  await editDialog.locator('textarea[formcontrolname="description"]').fill(updatedDescription);
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
  await editDialog.waitFor({ state: 'detached' });
  expenseCard = expenseList.locator('article').filter({ hasText: updatedDescription });
  await expenseCard.waitFor();
  await expenseCard.getByRole('button', { name: 'Delete OTHERS expense' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete expense' });
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expenseCard.waitFor({ state: 'detached' });

  await categoryFilter.click();
  await page.getByRole('option', { name: 'All categories', exact: true }).click();
  otherCard = expenseList.locator('article').filter({ hasText: otherDescription });
  await otherCard.waitFor();
  await otherCard.getByRole('button', { name: 'Delete FOOD expense' }).click();
  await page.getByRole('dialog', { name: 'Delete expense' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await otherCard.waitFor({ state: 'detached' });
  await receiptCard.getByRole('button', { name: 'Delete OTHERS expense' }).click();
  await page.getByRole('dialog', { name: 'Delete expense' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await receiptCard.waitFor({ state: 'detached' });
  console.log('PASS: Expense CRUD, category filtering, receipt attachment and Dashboard recent activity work on the phone');
}

async function exerciseIncomeCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Income', '/income');
  const incomeList = page.getByTestId('mobile-income-list');
  const suffix = crypto.randomUUID().slice(0, 8);
  const originalDescription = `Android QA Income ${suffix}`;
  const updatedDescription = `${originalDescription} Updated`;

  await page.getByRole('button', { name: 'Add Income', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Income' });
  await createDialog.locator('input[formcontrolname="amount"]').fill('246.80');
  await createDialog.locator('textarea[formcontrolname="description"]').fill(originalDescription);
  await createDialog.getByRole('button', { name: 'Add income', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  let incomeCard = incomeList.locator('article').filter({ hasText: originalDescription });
  await incomeCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Income create');
  const editTarget = await incomeCard.getByRole('button', { name: 'Edit SALARY income' }).boundingBox();
  if (!editTarget || editTarget.width < 44 || editTarget.height < 44) throw new Error('Income edit target is smaller than 44px');

  await incomeCard.getByRole('button', { name: 'Edit SALARY income' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Income' });
  await editDialog.locator('textarea[formcontrolname="description"]').fill(updatedDescription);
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
  try {
    await editDialog.waitFor({ state: 'detached', timeout: 10000 });
  } catch {
    const diagnostic = await editDialog.innerText().catch(() => 'Income edit dialog disappeared unexpectedly');
    throw new Error(`Income edit did not save: ${diagnostic}`);
  }
  incomeCard = incomeList.locator('article').filter({ hasText: updatedDescription });
  await incomeCard.waitFor();

  await incomeCard.getByRole('button', { name: 'Delete SALARY income' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete income' });
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await incomeCard.waitFor({ state: 'detached' });
  console.log('PASS: Income create, edit and delete completed on the phone list');
}

async function exerciseBankCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Bank accounts', '/banks');
  const bankList = page.getByTestId('mobile-bank-list');
  const bankName = `Android QA Bank ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole('button', { name: 'Add Bank Account', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Bank Account' });
  await createDialog.locator('input[formcontrolname="bankName"]').fill(bankName);
  await createDialog.locator('input[formcontrolname="balance"]').fill('4321');
  await createDialog.locator('input[formcontrolname="ifsc"]').fill('ABCD0123456');
  await createDialog.locator('input[formcontrolname="accountNumber"]').fill('123456789012');
  await createDialog.getByRole('button', { name: 'Add account', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  let bankCard = bankList.locator('article').filter({ hasText: bankName });
  await bankCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Bank account create');
  if (!(await bankCard.innerText()).replace(/[^0-9]/g, '').includes('4321')) throw new Error('Bank balance was not shown on its phone card');
  await bankCard.getByRole('button', { name: `Edit ${bankName}` }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit Bank Account' });
  await editDialog.locator('input[formcontrolname="balance"]').fill('5432');
  await editDialog.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
  await editDialog.waitFor({ state: 'detached' });
  bankCard = bankList.locator('article').filter({ hasText: bankName });
  await bankCard.waitFor();
  if (!(await bankCard.innerText()).replace(/[^0-9]/g, '').includes('5432')) throw new Error('Updated bank balance was not shown on its phone card');
  await bankCard.getByRole('button', { name: `Delete ${bankName}` }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete bank account' });
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await bankCard.waitFor({ state: 'detached' });
  console.log('PASS: Bank balance create, update and delete completed on the phone list');
}

async function exerciseCreditCardDetails(page, tabs) {
  await page.waitForURL('**/credit-cards');
  const cardName = `Android QA Card ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole('button', { name: 'Add Card', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Credit Card' });
  await createDialog.locator('input[formcontrolname="cardName"]').fill(cardName);
  await createDialog.locator('input[formcontrolname="bankName"]').fill('QA Bank');
  await createDialog.locator('input[formcontrolname="cardNumber"]').fill('4111111111111111');
  await createDialog.locator('input[formcontrolname="creditLimit"]').fill('10000');
  await createDialog.locator('input[formcontrolname="currentOutstanding"]').fill('350');
  await createDialog.getByRole('button', { name: 'Add card', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  const cardLink = page.getByRole('link', { name: `View ${cardName} details` });
  await cardLink.waitFor();
  await assertNoHorizontalOverflow(page, 'Credit Cards');
  await cardLink.click();
  await page.waitForURL(/\/credit-cards\/[^/]+$/);
  await assertNoHorizontalOverflow(page, 'Credit Card details');
  const statementMonth = new Date().getMonth() + 1;
  const statementYear = new Date().getFullYear();
  await page.getByRole('button', { name: 'Add Statement' }).click();
  const statementDialog = page.getByRole('dialog', { name: 'Add Statement' });
  await statementDialog.locator('input[formcontrolname="month"]').fill(String(statementMonth));
  await statementDialog.locator('input[formcontrolname="year"]').fill(String(statementYear));
  await statementDialog.locator('input[formcontrolname="totalDue"]').fill('350');
  await statementDialog.locator('input[formcontrolname="minimumDue"]').fill('35');
  await statementDialog.getByRole('button', { name: 'Add statement', exact: true }).click({ force: true });
  await statementDialog.waitFor({ state: 'detached' });
  const mobileStatements = page.getByTestId('mobile-card-statements');
  const statementCard = mobileStatements.locator('article').filter({ hasText: `${statementMonth}/${statementYear} statement` });
  await statementCard.waitFor();
  if (!(await statementCard.isVisible())) throw new Error('Statement did not render in the mobile card layout');

  await page.getByRole('button', { name: 'Record Payment' }).click();
  const paymentDialog = page.getByRole('dialog', { name: 'Record Payment' });
  await paymentDialog.locator('input[formcontrolname="amount"]').fill('50');
  await paymentDialog.locator('input[formcontrolname="method"]').fill('UPI');
  await paymentDialog.locator('input[formcontrolname="notes"]').fill(`Android QA payment ${cardName}`);
  await paymentDialog.locator('mat-select[formcontrolname="statementId"]').click();
  await page.getByRole('option').filter({ hasText: `${statementMonth}/${statementYear}` }).click();
  await paymentDialog.getByRole('button', { name: 'Record payment', exact: true }).click({ force: true });
  await paymentDialog.waitFor({ state: 'detached' });
  const paymentCard = page.getByTestId('mobile-card-payments').locator('article').filter({ hasText: `Android QA payment ${cardName}` });
  await paymentCard.waitFor();
  await statementCard.waitFor();
  const statementText = await statementCard.innerText();
  if (!/Remaining\s+₹?300/.test(statementText.replace(/,/g, ''))) throw new Error(`Payment did not reduce the statement balance: ${statementText}`);
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete credit card' });
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL('**/credit-cards');
  console.log('PASS: card due, statement and payment details work in the phone layout');
}

async function exerciseBudgetSummary(page, tabs) {
  await openFinanceRoute(page, tabs, 'Expenses', '/expenses');
  await page.getByRole('button', { name: 'Set Budget' }).click();
  const budgetDialog = page.getByRole('dialog', { name: 'Set Budget' });
  await budgetDialog.locator('input[formcontrolname="amount"]').fill('2000');
  await budgetDialog.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
  await budgetDialog.waitFor({ state: 'detached' });
  const budgetPanel = page.locator('.glass-card').filter({ hasText: 'Monthly Budget' }).first();
  await budgetPanel.getByText(/2,?000/).waitFor();
  await assertNoHorizontalOverflow(page, 'Budget summary');
  console.log('PASS: current-month budget can be set and reviewed on the phone');
}

async function exerciseFdPortfolioCrud(page, tabs) {
  await openFinanceRoute(page, tabs, 'Fixed deposits', '/fd/portfolio');
  const list = page.getByTestId('mobile-fd-list');
  const bankName = `Android QA FD ${crypto.randomUUID().slice(0, 8)}`;
  const updatedBankName = `${bankName} Updated`;
  await page.locator('app-page-header').getByRole('button', { name: 'Add FD', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add FD Portfolio Entry' });
  await createDialog.locator('input[formcontrolname="bankName"]').fill(bankName);
  await createDialog.locator('input[formcontrolname="amount"]').fill('15000');
  await createDialog.locator('input[formcontrolname="interestRate"]').fill('6.75');
  await createDialog.locator('input[formcontrolname="maturityDate"]').fill('12/31/2026');
  const createResponse = page.waitForResponse(response => response.url().endsWith('/fd/portfolio') && response.request().method() === 'POST');
  await createDialog.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
  const created = await createResponse;
  if (!created.ok()) throw new Error(`FD create failed (${created.status()}): ${(await created.text()).slice(0, 500)}`);
  const createdEntry = (await created.json()).data;
  await createDialog.waitFor({ state: 'detached' });

  let fdCard = page.getByTestId(`mobile-fd-${createdEntry.id}`);
  try {
    await fdCard.waitFor({ timeout: 10000 });
  } catch {
    const diagnostic = await page.evaluate(() => ({ url: location.href, fdText: document.querySelector('[data-testid="mobile-fd-list"]')?.innerText ?? null, bodyText: document.body.innerText.slice(-500) }));
    throw new Error(`Created FD did not render on mobile: ${JSON.stringify(diagnostic)}`);
  }
  await assertNoHorizontalOverflow(page, 'Fixed deposits');
  if (!(await fdCard.innerText()).includes('6.75%')) throw new Error('FD rate was not shown on its phone card');
  const editTarget = await fdCard.getByRole('button', { name: `Edit ${bankName} FD` }).boundingBox();
  if (!editTarget || editTarget.width < 44 || editTarget.height < 44) throw new Error(`FD edit target is smaller than 44px: ${JSON.stringify(editTarget)}`);

  await fdCard.getByRole('button', { name: `Edit ${bankName} FD` }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit FD Portfolio Entry' });
  await editDialog.locator('input[formcontrolname="bankName"]').fill(updatedBankName);
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
  await editDialog.waitFor({ state: 'detached' });
  fdCard = list.locator('article').filter({ hasText: updatedBankName });
  await fdCard.waitFor();
  await fdCard.getByRole('button', { name: `Delete ${updatedBankName} FD` }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Delete FD entry' });
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await fdCard.waitFor({ state: 'detached' });
  console.log('PASS: FD mobile create, edit and delete workflow completed');
}

async function exerciseMutualFundsMobile(page, tabs) {
  await openFinanceRoute(page, tabs, 'Investments', '/investments');
  await page.getByRole('button', { name: 'Add Investment', exact: true }).click();
  const createDialog = page.getByRole('dialog', { name: 'Add Investment' });
  const categorySelect = createDialog.locator('mat-select[formcontrolname="category"]');
  await categorySelect.click();
  await page.getByRole('option', { name: 'MUTUAL_FUNDS', exact: true }).click();
  const fundName = `Android QA Mutual Fund ${crypto.randomUUID().slice(0, 8)}`;
  await createDialog.locator('input[formcontrolname="name"]').fill(fundName);
  await createDialog.locator('input[formcontrolname="principalAmount"]').fill('2500');
  await createDialog.locator('input[formcontrolname="currentValue"]').fill('2875');
  await createDialog.getByRole('button', { name: 'Add investment', exact: true }).click({ force: true });
  await createDialog.waitFor({ state: 'detached' });

  await openFinanceRoute(page, tabs, 'Mutual funds', '/mutual-funds');
  const list = page.getByTestId('mobile-mf-list');
  const fundCard = list.locator('article').filter({ hasText: fundName });
  await fundCard.waitFor();
  await assertNoHorizontalOverflow(page, 'Mutual funds');
  if (!(await fundCard.innerText()).includes('₹2,875')) throw new Error(`Mutual-fund current value was not shown: ${await fundCard.innerText()}`);
  const fundLink = fundCard.getByRole('link', { name: fundName });
  await fundLink.click();
  await page.waitForURL(/\/mutual-funds\/[^/]+$/);
  await assertNoHorizontalOverflow(page, 'Mutual fund detail');
  await page.getByTestId('mobile-mf-transactions').locator('article').waitFor();
  await page.getByRole('link', { name: 'Back' }).click();
  await page.waitForURL('**/mutual-funds');
  console.log('PASS: Mutual Funds phone cards and scheme transaction detail render without overflow');
}

async function exerciseHealthSourcePreference(page, accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const connectionResponse = await getWithRetry(`${api}/health/connections`, {
    method: 'POST', headers,
    body: JSON.stringify({
      deviceName: 'Android QA Health', timezone: 'UTC', enabledMetrics: ['STEPS'], grantedMetrics: ['STEPS'],
      backgroundReadGranted: false, backgroundReadAvailable: false, consent: true,
    }),
  });
  if (!connectionResponse.ok) throw new Error(`Health connection creation failed (${connectionResponse.status})`);
  const connection = (await connectionResponse.json()).data;
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const syncResponse = await getWithRetry(`${api}/health/sync`, {
    method: 'POST', headers,
    body: JSON.stringify({
      connectionId: connection.id, generation: connection.generation, batchId: crypto.randomUUID(),
      syncStartedAt: now, completed: true,
      records: [{ sourceRecordId: crypto.randomUUID(), metricType: 'STEPS', source: 'qa.health.app', startTime: now, endTime: now, modifiedAt: now, value: 120, unit: 'count' }],
      deletions: [], daily: [{ date, steps: 999 }],
    }),
  });
  if (!syncResponse.ok) throw new Error(`Health record upload failed (${syncResponse.status})`);

  const component = page.locator('app-health-connection');
  await component.waitFor();
  await page.evaluate(() => window.ng.getComponent(document.querySelector('app-health-connection')).load());
  const sourceControls = page.getByTestId('health-source-controls');
  await sourceControls.waitFor();
  const stepsSource = sourceControls.locator('mat-form-field').filter({ hasText: 'Steps source' }).locator('mat-select');
  await stepsSource.click();
  await page.getByRole('option', { name: 'qa.health.app', exact: true }).click();
  const preferenceResponse = page.waitForResponse(response => response.url().endsWith(`/health/connections/${connection.id}/sources`) && response.request().method() === 'PUT');
  await sourceControls.getByRole('button', { name: 'Save sources' }).click();
  const saved = await preferenceResponse;
  if (!saved.ok()) throw new Error(`Health source preference update failed (${saved.status()})`);
  const dailyResponse = await getWithRetry(`${api}/health/daily?days=1`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!dailyResponse.ok) throw new Error(`Canonical health summary failed (${dailyResponse.status})`);
  const summary = (await dailyResponse.json()).data.days.find(day => day.date === date);
  if (summary?.steps !== 120 || summary?.nativeReference?.steps !== 999) {
    throw new Error(`Health source selection did not separate canonical and device totals: ${JSON.stringify({ steps: summary?.steps, reference: summary?.nativeReference?.steps })}`);
  }
  await page.evaluate(() => window.ng.getComponent(document.querySelector('app-health-connection')).load());
  try {
    await component.getByText('qa.health.app · 1 record(s)').waitFor();
  } catch {
    const diagnostic = await page.evaluate(() => {
      const component = window.ng.getComponent(document.querySelector('app-health-connection'));
      return {
        selectedDate: component.selectedDate(),
        selected: component.selected(),
        primarySourceSelection: component.primarySourceSelection(),
        daily: component.daily()?.days?.slice(-2),
      };
    });
    throw new Error(`Canonical Health API passed but its provenance did not render: ${JSON.stringify(diagnostic)}`);
  }
  await assertNoHorizontalOverflow(page, 'Health source preferences');
  console.log('PASS: Health source selection renders provenance and uses backend canonical totals on Android');
}

async function syncAndAssertSteps(accessToken, expectedSteps, previousSyncAt) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const initialResponse = await getWithRetry(`${api}/health/sync/status`, { headers });
  if (!initialResponse.ok) throw new Error(`Backend sync status failed (${initialResponse.status})`);
  const initialConnection = (await initialResponse.json()).data.connection;
  const baselineSyncAt = previousSyncAt ?? initialConnection?.lastSuccessfulSyncAt ?? null;
  await testPage.getByRole('button', { name: 'Sync now', exact: true }).click({ force: true });
  let connection;
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await getWithRetry(`${api}/health/sync/status`, { headers });
    if (!response.ok) throw new Error(`Backend sync status failed (${response.status})`);
    connection = (await response.json()).data.connection;
    if (connection?.status === 'SUCCESS' && connection.lastSuccessfulSyncAt && connection.lastSuccessfulSyncAt !== baselineSyncAt) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  const native = await testPage.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}));
  if (!connection || connection.status !== 'SUCCESS' || connection.lastSuccessfulSyncAt === baselineSyncAt) {
    throw new Error(`Foreground sync timed out: ${JSON.stringify({ backendStatus: connection?.status, nativeState: native.state, backendLastSuccess: connection?.lastSuccessfulSyncAt, nativeLastSuccess: native.lastSuccessfulSyncAt })}`);
  }
  if (connection.id !== native.connectionId) {
    throw new Error(`Backend/native connection IDs differ: ${connection.id} != ${native.connectionId}`);
  }
  if (connection.recordsSynced < 1) throw new Error('Backend did not record an imported-record change');
  const steps = await backendDailySteps(accessToken);
  if (steps !== expectedSteps) throw new Error(`Expected ${expectedSteps} daily Steps, received ${steps}`);
  return native.lastSuccessfulSyncAt;
}

async function waitForPermissionDialog() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      adbRun(['shell', 'uiautomator', 'dump', '/sdcard/lifetrack-health-smoke.xml']);
      const xml = adbRun(['shell', 'cat', '/sdcard/lifetrack-health-smoke.xml']);
      if (xml.includes('healthconnect.controller')) return xml;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Health Connect permission dialog did not appear');
}

async function connectWebView() {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const response = await fetch(`${debugUrl}/json/version`);
      if (response.ok) return await chromium.connectOverCDP(debugUrl);
    } catch (error) { lastError = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Android WebView debug endpoint did not become ready: ${lastError?.message || 'unavailable'}`);
}

async function grantStepsOnly(page) {
  const expectedBackground = backgroundSmoke;
  const initialStatus = await page.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {}));
  if (initialStatus.grantedMetrics.length === 1 && initialStatus.grantedMetrics[0] === 'STEPS' && initialStatus.backgroundReadGranted === expectedBackground) return;
  let xml;
  try {
    xml = await waitForPermissionDialog();
  } catch {
    const status = await page.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {}));
    if (status.grantedMetrics.length === 1 && status.grantedMetrics[0] === 'STEPS' && status.backgroundReadGranted === expectedBackground) return;
    throw new Error('Permission prompt did not appear and existing grants do not match the requested smoke mode');
  }
  const nodeTags = () => [...xml.matchAll(/<node\b[^>]*>/g)].map(match => parseAttributes(match[0]));
  const backgroundPrompt = nodeTags().find(node => /access data in the background/i.test(node.text || ''));
  if (backgroundPrompt) {
    const status = await page.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {}));
    if (!expectedBackground || status.grantedMetrics.length !== 1 || status.grantedMetrics[0] !== 'STEPS') {
      throw new Error(`Background access prompt appeared with unexpected permissions: ${JSON.stringify(status.grantedMetrics)}`);
    }
    const allowNode = nodeTags().find(node => node.text === 'Allow');
    const allowBounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(allowNode?.bounds || '');
    if (!allowBounds) throw new Error('Background access Allow button was not found');
    const allowX = Math.floor((Number(allowBounds[1]) + Number(allowBounds[3])) / 2);
    const allowY = Math.floor((Number(allowBounds[2]) + Number(allowBounds[4])) / 2);
    adbRun(['shell', 'input', 'tap', String(allowX), String(allowY)]);
    await page.waitForFunction(async expectedBackground => {
      const current = await window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {});
      return current.grantedMetrics.length === 1 && current.grantedMetrics[0] === 'STEPS' && current.backgroundReadGranted === expectedBackground;
    }, true, { timeout: 15000 });
    return;
  }
  const stepNode = nodeTags().find(node => (node['content-desc'] || '').startsWith('Steps.') && (node['content-desc'] || '').endsWith('Off'));
  if (!stepNode) throw new Error('Steps toggle was not present in permission dialog');
  const stepBounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(stepNode.bounds || '');
  if (!stepBounds) throw new Error('Steps toggle had no bounds');
  const stepX = Math.floor((Number(stepBounds[1]) + Number(stepBounds[3])) / 2);
  const stepY = Math.floor((Number(stepBounds[2]) + Number(stepBounds[4])) / 2);
  adbRun(['shell', 'input', 'tap', String(stepX), String(stepY)]);
  await new Promise(resolve => setTimeout(resolve, 500));
  adbRun(['shell', 'uiautomator', 'dump', '/sdcard/lifetrack-health-smoke.xml']);
  xml = adbRun(['shell', 'cat', '/sdcard/lifetrack-health-smoke.xml']);
  if (/Exercise\. Read Access\. On|Sleep\. Read Access\. On|Heart rate\. Read Access\. On|Weight\. Read Access\. On/.test(xml)) {
    throw new Error('Unexpected metric permission is enabled; refusing test');
  }
  const allowNode = [...xml.matchAll(/<node\b[^>]*>/g)].map(match => parseAttributes(match[0]))
    .find(node => node['resource-id'] === 'android:id/primary_button' || node.text === 'Allow');
  if (!allowNode) throw new Error('Permission Allow button was not found');
  const allowBounds = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(allowNode.bounds || '');
  if (!allowBounds) throw new Error('Permission Allow button had no bounds');
  const allowX = Math.floor((Number(allowBounds[1]) + Number(allowBounds[3])) / 2);
  const allowY = Math.floor((Number(allowBounds[2]) + Number(allowBounds[4])) / 2);
  adbRun(['shell', 'input', 'tap', String(allowX), String(allowY)]);
  await page.waitForFunction(async expectedBackground => {
    const status = await window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {});
    return status.grantedMetrics.length === 1 && status.grantedMetrics[0] === 'STEPS' && status.backgroundReadGranted === expectedBackground;
  }, expectedBackground, { timeout: 15000 });
}

async function main() {
  if (process.argv.includes('--cleanup-only')) {
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    const pid = await waitForAppPid();
    adbRun(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
    browser = await connectWebView();
    testPage = browser.contexts()[0].pages()[0];
    await testPage.waitForFunction(() => !!window.Capacitor?.nativePromise, undefined, { timeout: 15000 });
    const status = await testPage.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'disconnectHealth', {}));
    console.log(`PASS: native health state cleared (${status.state})`);
    return;
  }
  const health = await fetch('http://localhost:4000/health');
  if (!health.ok) throw new Error('Backend is not healthy on localhost:4000');
  const registration = await fetch(`${api}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Temporary Capacitor Sync Test', email, password }),
  });
  if (!registration.ok) throw new Error(`Temporary test account creation failed (${registration.status})`);
  const auth = (await registration.json()).data;
  cleanupAccessTokens.push(auth.accessToken);
  let accountSwitchAuth;
  if (accountSwitchRaceSmoke) {
    const secondRegistration = await fetch(`${api}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Temporary Capacitor Account Switch Test', email: accountSwitchEmail, password: accountSwitchPassword }),
    });
    if (!secondRegistration.ok) throw new Error(`Temporary account-switch user creation failed (${secondRegistration.status})`);
    accountSwitchAuth = (await secondRegistration.json()).data;
    cleanupAccessTokens.push(accountSwitchAuth.accessToken);
  }
  if (logoutRaceSmoke || strictRefreshRaceSmoke) workerRefreshProxy = await startHeldRefreshProxy();

  adbRun(['reverse', 'tcp:4000', 'tcp:4000']);
  if (skipInstall) {
    if (!adbRun(['shell', 'pm', 'path', 'com.lifetrack.app.spike']).startsWith('package:')) {
      throw new Error('Cannot skip APK install because LifeTrack is not installed');
    }
  } else {
    adbRun(['install', '-r', apk]);
  }
  if (!backgroundSmoke && !uiOnly) {
    adbRun(['install', '-r', writerApk]);
    const writerPackage = adbRun(['shell', 'dumpsys', 'package', 'com.lifetrack.health']);
    if (!/android\.permission\.health\.WRITE_STEPS:\s*granted=true/.test(writerPackage)) {
      throw new Error('Grant Steps write access to LifeTrack Health in Health Connect settings before the record-mutation smoke');
    }
  }
  adbRun(['shell', 'am', 'force-stop', 'com.lifetrack.app.spike']);
  adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
  const pid = await waitForAppPid();
  adbRun(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
  browser = await connectWebView();
  const page = browser.contexts()[0].pages()[0];
  testPage = page;
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.waitForFunction(() => !!document.querySelector('app-root') && !!window.Capacitor?.nativePromise, undefined, { timeout: 30000 });
  await page.evaluate(async () => {
    await window.Capacitor.nativePromise('HealthBridge', 'disconnectHealth', {});
    await window.Capacitor.nativePromise('SessionVault', 'clear', {});
    localStorage.removeItem('pft.refreshToken');
    location.replace('/auth/login');
  });
  await page.locator('input[type="email"]').waitFor({ timeout: 30000 });
  if (uiOnly) await assertNoHorizontalOverflow(page, 'Login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  let loginDiagnostic = null;
  page.on('response', async response => {
    if (!response.url().endsWith('/auth/login')) return;
    let message = null;
    try { message = (await response.json())?.message ?? null; } catch {}
    loginDiagnostic = { status: response.status(), message };
  });
  page.on('requestfailed', request => {
    if (request.url().endsWith('/auth/login')) loginDiagnostic = { networkError: request.failure()?.errorText ?? 'request failed' };
  });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click({ force: true });
  try {
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  } catch {
    const nativeRefreshProbe = await page.evaluate(async apiBaseUrl => {
      try {
        const session = await window.Capacitor.nativePromise('SessionVault', 'refreshSession', { apiBaseUrl });
        return { ok: true, userPresent: !!session.user };
      } catch (error) {
        return { ok: false, code: error.code ?? null, message: error.message };
      }
    }, 'http://10.0.2.2:4000/api/v1').catch(error => ({ ok: false, message: error.message }));
    const diagnostic = await page.evaluate(async loginDiagnostic => ({
      url: location.href,
      bodyText: document.body.innerText.slice(0, 360),
      localRefreshTokenPresent: localStorage.getItem('pft.refreshToken') !== null,
      keystoreRefreshTokenPresent: !!(await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token,
      loginDiagnostic,
    }), loginDiagnostic).catch(error => ({ evaluationError: error.message }));
    throw new Error(`Temporary-account login did not reach Dashboard: ${JSON.stringify({ ...diagnostic, nativeRefreshProbe })}`);
  }
  console.log('PASS: temporary-account sign-in on packaged Angular app');
  if (await page.evaluate(() => localStorage.getItem('pft.refreshToken') !== null)) throw new Error('Refresh token persisted in WebView localStorage');
  const vault = await page.evaluate(() => window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {}));
  if (!vault.token) throw new Error('Refresh token missing from Keystore vault');
  initialRefreshToken = vault.token;
  console.log('PASS: native Keystore session, no WebView refresh token');

  if (uiOnly) {
    await assertNoHorizontalOverflow(page, 'Dashboard');
    await page.waitForFunction(() => {
      const tour = document.querySelector('app-onboarding-tour');
      return !!tour && window.ng.getComponent(tour).isOpen();
    }, undefined, { timeout: 10000 });
    await page.evaluate(() => window.ng.getComponent(document.querySelector('app-onboarding-tour')).skip());
    await page.waitForFunction(() => !window.ng.getComponent(document.querySelector('app-onboarding-tour')).isOpen());
    const unsupportedDashboardLinks = await page.locator('a[href]').evaluateAll(anchors => anchors
      .map(anchor => new URL(anchor.href).pathname)
      .filter(path => ['/financial-health', '/financial-level', '/analytics', '/reports'].includes(path)));
    if (unsupportedDashboardLinks.length) throw new Error(`Native Dashboard exposed web-first routes: ${unsupportedDashboardLinks.join(', ')}`);
    const tabs = page.getByRole('navigation', { name: 'Primary navigation' });
    try {
      for (const label of ['Home', 'Finance', 'Health', 'More']) await tabs.getByText(label, { exact: true }).waitFor({ timeout: 10000 });
    } catch {
      const diagnostic = await page.evaluate(() => {
        const shell = document.querySelector('app-shell');
        return {
          url: location.href,
          platform: window.Capacitor?.getPlatform?.(),
          native: window.Capacitor?.isNativePlatform?.(),
          shellNative: shell ? window.ng?.getComponent(shell)?.isNative : null,
          primaryNav: !!document.querySelector('nav[aria-label="Primary navigation"]'),
          bodyText: document.body.innerText.slice(0, 240),
        };
      }).catch(() => null);
      throw new Error(`Native bottom navigation did not render: ${JSON.stringify(diagnostic)}`);
    }
    await tabs.getByRole('button', { name: 'Finance' }).click();
    const financePanel = page.getByRole('dialog', { name: 'Finance navigation' });
    for (const label of ['Expenses', 'Income', 'Transactions', 'Bank accounts', 'Cards', 'Fixed deposits', 'Mutual funds', 'Goals', 'Investments']) {
      await financePanel.getByRole('link', { name: new RegExp(label, 'i') }).waitFor();
    }
    console.log('PASS: native Home, Finance, Health and More tabs render');
    if (healthSourceOnly) {
      await financePanel.getByRole('button', { name: 'Close navigation menu' }).click();
      await tabs.getByRole('link', { name: 'Health' }).click();
      await page.waitForURL('**/health');
      await assertNoHorizontalOverflow(page, 'Health');
      await exerciseHealthSourcePreference(page, auth.accessToken);
      return;
    }
    if (fdPortfolioOnly) {
      const fdLink = financePanel.getByRole('link', { name: /Fixed deposits/ });
      const fdHref = await fdLink.getAttribute('href');
      await fdLink.click();
      try {
        await page.waitForURL('**/fd/portfolio', { timeout: 10000 });
      } catch {
        const diagnostic = await page.evaluate(() => {
          const shell = document.querySelector('app-shell');
          const component = shell ? window.ng.getComponent(shell) : null;
          return {
            url: location.href,
            routerUrl: component?.router?.url ?? null,
            routes: component?.router?.config?.map(route => ({ path: route.path, children: route.children?.map(child => child.path) })) ?? [],
            links: [...document.querySelectorAll('.mobile-nav-link')].map(link => ({ text: link.textContent?.trim(), href: link.getAttribute('href') })),
            bodyText: document.body.innerText.slice(0, 320),
          };
        });
        throw new Error(`FD navigation failed: ${JSON.stringify({ fdHref, ...diagnostic, pageErrors })}`);
      }
      await page.getByTestId('mobile-fd-list').waitFor();
      await assertNoHorizontalOverflow(page, 'Fixed deposits');
      console.log('PASS: native Finance panel opens the mobile FD portfolio');
      await exerciseFdPortfolioCrud(page, tabs);
      return;
    }
    if (mutualFundsOnly) {
      await financePanel.getByRole('button', { name: 'Close navigation menu' }).click();
      await exerciseMutualFundsMobile(page, tabs);
      return;
    }
    await financePanel.getByRole('link', { name: /Expenses/ }).click();
    await page.waitForURL('**/expenses');
    const mobileExpenses = page.getByTestId('mobile-expense-list');
    await mobileExpenses.waitFor();
    await assertNoHorizontalOverflow(page, 'Expenses');
    const expenseViews = await page.evaluate(() => ({
      mobile: document.querySelector('[data-testid="mobile-expense-list"]')?.getBoundingClientRect().width ?? 0,
      desktop: document.querySelector('app-data-table')?.getBoundingClientRect().width ?? 0,
    }));
    if (expenseViews.mobile <= 0 || expenseViews.desktop > 0) throw new Error('Expenses did not switch to its phone card layout');
    await exerciseExpenseCrud(page, tabs);
    const financeListRoutes = [
      { label: 'Income', path: '/income', mobileSelector: '[data-testid="mobile-income-list"]' },
      { label: 'Bank accounts', path: '/banks', mobileSelector: '[data-testid="mobile-bank-list"]' },
      { label: 'Fixed deposits', path: '/fd/portfolio', mobileSelector: '[data-testid="mobile-fd-list"]' },
      { label: 'Goals', path: '/goals', mobileSelector: '[data-testid="mobile-goal-list"]' },
      { label: 'Investments', path: '/investments', mobileSelector: '[data-testid="mobile-investment-list"]' },
      { label: 'Transactions', path: '/transactions', mobileSelector: '[aria-label="Transactions list"]' },
    ];
    for (const route of financeListRoutes) {
      await tabs.getByRole('button', { name: 'Finance' }).click();
      await page.getByRole('dialog', { name: 'Finance navigation' }).getByRole('link', { name: new RegExp(route.label, 'i') }).click();
      await page.waitForURL(`**${route.path}`);
      await page.locator(route.mobileSelector).waitFor();
      await assertNoHorizontalOverflow(page, route.label);
      const dimensions = await page.evaluate(selector => ({
        mobile: document.querySelector(selector)?.getBoundingClientRect().width ?? 0,
        desktop: document.querySelector('app-data-table')?.getBoundingClientRect().width ?? 0,
      }), route.mobileSelector);
      if (dimensions.mobile <= 0 || dimensions.desktop > 0) throw new Error(`${route.label} did not switch to its phone list`);
    }
    await tabs.getByRole('button', { name: 'Finance' }).click();
    await page.getByRole('dialog', { name: 'Finance navigation' }).getByRole('link', { name: /Cards/ }).click();
    await page.waitForURL('**/credit-cards');
    await page.getByText('No credit cards yet', { exact: true }).waitFor();
    await assertNoHorizontalOverflow(page, 'Credit Cards');
    console.log('PASS: Finance panel reaches all phone lists without horizontal overflow');
    await exerciseCreditCardDetails(page, tabs);
    await exerciseGoalCrud(page, tabs);
    await exerciseInvestmentCrud(page, tabs);
    await exerciseIncomeCrud(page, tabs);
    await exerciseBankCrud(page, tabs);
    await exerciseFdPortfolioCrud(page, tabs);
    await exerciseMutualFundsMobile(page, tabs);
    await exerciseBudgetSummary(page, tabs);
    await tabs.getByRole('button', { name: 'More' }).click();
    const morePanel = page.getByRole('dialog', { name: 'More navigation' });
    for (const label of ['Notifications', 'Profile', 'Settings']) await morePanel.getByRole('link', { name: new RegExp(label, 'i') }).waitFor();
    await morePanel.getByRole('link', { name: /Notifications/ }).click();
    await page.waitForURL('**/notifications');
    await page.getByRole('heading', { name: 'Notifications' }).waitFor();
    await assertNoHorizontalOverflow(page, 'Notifications');
    await tabs.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More navigation' }).getByRole('link', { name: /Profile/ }).click();
    await page.waitForURL('**/profile');
    await page.getByRole('heading', { name: 'Profile' }).waitFor();
    await assertNoHorizontalOverflow(page, 'Profile');
    await tabs.getByRole('button', { name: 'More' }).click();
    await morePanel.getByRole('link', { name: /Settings/ }).click();
    await page.waitForURL('**/settings');
    await page.getByRole('heading', { name: 'Settings' }).waitFor();
    await assertNoHorizontalOverflow(page, 'Settings');
    await tabs.getByRole('link', { name: 'Health' }).click();
    await page.waitForURL('**/health');
    await assertNoHorizontalOverflow(page, 'Health');
    await exerciseHealthSourcePreference(page, auth.accessToken);
    await page.getByRole('link', { name: /Body Metrics/ }).click();
    await page.waitForURL('**/health/body-metrics');
    await assertNoHorizontalOverflow(page, 'Health body metrics');
    console.log('PASS: More panel and direct Health navigation reach Settings and Health');
    return;
  }

  await page.locator('a[href$="/health"]').first().evaluate(element => element.click());
  await page.getByRole('button', { name: 'Allow selected metrics', exact: true }).waitFor();
  console.log('PASS: Health permission panel opened');
  await page.evaluate(background => {
    const component = window.ng.getComponent(document.querySelector('app-health-connection'));
    component.selectNativeMetric('STEPS', true);
    component.nativeBackground.set(background);
    component.nativeConsent.set(true);
  }, backgroundSmoke);
  const permissionsAlreadyMatch = await page.evaluate(async background => {
    const status = await window.Capacitor.nativePromise('HealthBridge', 'getHealthConnectionStatus', {});
    return status.grantedMetrics.length === 1 && status.grantedMetrics[0] === 'STEPS' && status.backgroundReadGranted === background;
  }, backgroundSmoke);
  if (!permissionsAlreadyMatch) {
    await page.getByRole('button', { name: 'Allow selected metrics', exact: true }).click({ force: true });
    await grantStepsOnly(page);
  }
  console.log(backgroundSmoke
    ? 'PASS: only Steps and explicitly selected background-read permissions are granted'
    : 'PASS: only Steps permission granted; background and other metrics remain ungranted');

  await page.waitForFunction(async () => {
    const status = await window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {});
    return status.state === 'DISCONNECTED';
  }, undefined, { timeout: 15000 });
  if (recoverySmoke) {
    await page.evaluate(() => {
      const component = window.ng.getComponent(document.querySelector('app-health-connection'));
      const bridge = component.bridge;
      const connectHealth = bridge.connectHealth.bind(bridge);
      bridge.connectHealth = async (...args) => {
        window.__healthConnectPending = true;
        await new Promise(resolve => { window.__resumeHealthConnect = resolve; });
        return connectHealth(...args);
      };
    });
  }
  if (recoverySmoke) {
    await page.evaluate(() => {
      void window.ng.getComponent(document.querySelector('app-health-connection')).connectNativeHealth();
    });
  } else if (logoutRaceSmoke) {
    await page.evaluate(apiBaseUrl => {
      const component = window.ng.getComponent(document.querySelector('app-health-connection'));
      component.bridge.connectHealth = (connectionId, generation, enabledMetrics, backgroundRequested) =>
        window.Capacitor.nativePromise('HealthBridge', 'connectHealth', {
          connectionId, generation, enabledMetrics, apiBaseUrl, backgroundRequested,
        });
      void component.connectNativeHealth();
    }, workerRefreshProxy.apiBaseUrl);
  } else if (strictRefreshRaceSmoke) {
    await page.evaluate(apiBaseUrl => {
      const component = window.ng.getComponent(document.querySelector('app-health-connection'));
      component.bridge.connectHealth = (connectionId, generation, enabledMetrics, backgroundRequested) =>
        window.Capacitor.nativePromise('HealthBridge', 'connectHealth', {
          connectionId, generation, enabledMetrics, apiBaseUrl, backgroundRequested,
        });
      void component.connectNativeHealth();
    }, workerRefreshProxy.apiBaseUrl);
  } else if (refreshRaceSmoke) {
    await page.evaluate(() => {
      void window.ng.getComponent(document.querySelector('app-health-connection')).connectNativeHealth();
    });
  } else {
    await page.getByRole('button', { name: 'Connect selected metrics', exact: true }).click({ force: true });
  }
  if (recoverySmoke) {
    try {
      await page.waitForFunction(() => window.__healthConnectPending === true, undefined, { timeout: 20000 });
    } catch {
      const diagnostic = await page.evaluate(() => {
        const component = window.ng.getComponent(document.querySelector('app-health-connection'));
        return {
          error: component.nativeError(),
          busy: component.nativeBusy(),
          selected: component.nativeSelected(),
          consent: component.nativeConsent(),
          background: component.nativeBackground(),
          health: component.nativeStatus()?.health,
          syncState: component.nativeStatus()?.sync.state,
        };
      }).catch(() => null);
      throw new Error(`Connect did not reach native bridge: ${JSON.stringify(diagnostic)}`);
    }
    setEmulatorNetwork(false);
    emulatorNetworkDisabled = true;
    await page.evaluate(() => window.__resumeHealthConnect());
  }
  try {
    await page.getByRole('button', { name: 'Sync now', exact: true }).waitFor({ timeout: 20000 });
  } catch {
    const diagnostic = await page.evaluate(() => {
      const component = window.ng.getComponent(document.querySelector('app-health-connection'));
      return {
        error: component.nativeError(),
        busy: component.nativeBusy(),
        grantedMetrics: component.nativeStatus()?.health.grantedMetrics,
        syncState: component.nativeStatus()?.sync.state,
      };
    }).catch(() => null);
    throw new Error(`Native connection did not become ready: ${JSON.stringify(diagnostic)}`);
  }
  const nativeConnection = await page.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}));
  if (!nativeConnection.connectionId || !nativeConnection.syncSupported) throw new Error('Native connection was not persisted');
  if (nativeConnection.lastSuccessfulSyncAt || nativeConnection.lastAttemptedSyncAt || nativeConnection.recordsSynced !== 0) {
    throw new Error('New connection inherited stale local sync status');
  }
  connectionId = nativeConnection.connectionId;
  console.log('PASS: authenticated backend connection registered on Android');

  if (logoutRaceSmoke) {
    adbRun(['shell', 'input', 'keyevent', '3']);
    await waitFor(workerRefreshProxy.refreshSeen, 45000, 'WorkManager did not start its held refresh request');
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    const logoutResponse = testPage.waitForResponse(response => response.url().endsWith('/auth/logout'), { timeout: 30000 });
    await testPage.evaluate(() => {
      const navbar = document.querySelector('app-navbar');
      if (!navbar) throw new Error('Navbar was unavailable for the logout race');
      window.ng.getComponent(navbar).logout();
    });
    const logoutResult = await logoutResponse;
    if (!logoutResult.ok()) throw new Error(`Application logout failed (${logoutResult.status()})`);
    let expectedUserId = null;
    let expectedRefreshToken = null;
    if (accountSwitchRaceSmoke) {
      const loginResponse = testPage.waitForResponse(response => response.url().endsWith('/auth/login'), { timeout: 30000 });
      await testPage.evaluate(credentials => {
        const navbar = document.querySelector('app-navbar');
        const authService = window.ng.getComponent(navbar).authService;
        window.__accountSwitchLogin = { complete: false, error: null };
        authService.login(credentials).subscribe({
          error: error => { window.__accountSwitchLogin.error = error.message || 'login failed'; },
          complete: () => { window.__accountSwitchLogin.complete = true; },
        });
      }, { email: accountSwitchEmail, password: accountSwitchPassword });
      const loginResult = await loginResponse;
      if (!loginResult.ok()) throw new Error(`Second-user login failed (${loginResult.status()})`);
      const loginSession = (await loginResult.json()).data;
      expectedUserId = accountSwitchAuth.user.id;
      expectedRefreshToken = loginSession.refreshToken;
      if (loginSession.user?.id !== expectedUserId || !expectedRefreshToken) {
        throw new Error('Second-user login returned an unexpected account or missing refresh token');
      }
    }
    workerRefreshProxy.release();
    const staleRefreshStatus = await waitFor(workerRefreshProxy.refreshStatus, 20000, 'Held worker refresh did not return after logout');
    if (staleRefreshStatus !== 401) throw new Error(`Expected revoked worker refresh to return 401, received ${staleRefreshStatus}`);
    if (accountSwitchRaceSmoke) {
      await testPage.waitForFunction(() => window.__accountSwitchLogin?.complete || window.__accountSwitchLogin?.error, undefined, { timeout: 30000 });
      const switchedSession = await testPage.evaluate(async () => ({
        login: window.__accountSwitchLogin,
        userId: window.ng.getComponent(document.querySelector('app-navbar')).authService.currentUser()?.id ?? null,
        refreshToken: (await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token,
        localToken: localStorage.getItem('pft.refreshToken'),
        sync: await window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}),
      }));
      if (switchedSession.login.error || switchedSession.userId !== expectedUserId || switchedSession.refreshToken !== expectedRefreshToken || switchedSession.localToken || switchedSession.sync.connectionId || switchedSession.sync.state !== 'DISCONNECTED') {
        throw new Error(`Account switch did not survive the delayed worker refresh: ${JSON.stringify(switchedSession)}`);
      }
      console.log('PASS: second-user session survived the revoked worker refresh without restoring Health connection state');
    } else {
      await testPage.waitForURL('**/auth/login', { timeout: 30000 });
      const clearedSession = await testPage.evaluate(async () => ({
        refreshToken: (await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token,
        localToken: localStorage.getItem('pft.refreshToken'),
        sync: await window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}),
      }));
      if (clearedSession.refreshToken || clearedSession.localToken || clearedSession.sync.connectionId || clearedSession.sync.state !== 'DISCONNECTED') {
        throw new Error(`Logout did not invalidate the delayed worker session: ${JSON.stringify(clearedSession)}`);
      }
      console.log('PASS: logout revoked a held worker refresh and left no token or native connection');
    }
    connectionId = null;
  }

  if (backgroundSmoke && !logoutRaceSmoke) {
    const initialResponse = await getWithRetry(`${api}/health/sync/status`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
    const baselineSyncAt = (await initialResponse.json()).data.connection?.lastSuccessfulSyncAt ?? null;
    if (strictRefreshRaceSmoke) {
      await waitFor(workerRefreshProxy.refreshSeen, 45000, 'WorkManager did not begin its refresh request');
      await testPage.evaluate(apiBaseUrl => {
        window.__strictUiRefreshStarted = true;
        window.__strictUiRefreshPromise = window.Capacitor.nativePromise('SessionVault', 'refreshSession', { apiBaseUrl })
          .then(session => { window.__strictUiRefreshResult = { userId: session.user?.id ?? null }; })
          .catch(error => { window.__strictUiRefreshError = error.message || 'UI refresh failed'; });
      }, workerRefreshProxy.apiBaseUrl);
      await new Promise(resolve => setTimeout(resolve, 500));
      const uiRefreshWaiting = await testPage.evaluate(() => window.__strictUiRefreshStarted && !window.__strictUiRefreshResult && !window.__strictUiRefreshError);
      if (!uiRefreshWaiting || workerRefreshProxy.refreshTokens.length !== 1) {
        throw new Error(`Expected UI refresh to wait behind the held worker refresh; pending=${uiRefreshWaiting}, requests=${workerRefreshProxy.refreshTokens.length}`);
      }
      workerRefreshProxy.release();
      await testPage.waitForFunction(() => window.__strictUiRefreshResult || window.__strictUiRefreshError, undefined, { timeout: 30000 });
      const firstStatus = await waitFor(workerRefreshProxy.refreshStatus, 20000, 'Worker refresh did not complete');
      const secondStatus = await waitFor(workerRefreshProxy.secondRefreshStatus, 20000, 'Queued UI refresh did not reach the backend');
      const uiResult = await testPage.evaluate(() => ({ result: window.__strictUiRefreshResult, error: window.__strictUiRefreshError }));
      const refreshTokens = workerRefreshProxy.refreshTokens;
      if (firstStatus !== 200 || secondStatus !== 200 || refreshTokens.length < 2 || refreshTokens[0] !== initialRefreshToken || refreshTokens[1] === refreshTokens[0] || !uiResult.result?.userId) {
        throw new Error(`Strict UI/worker refresh overlap failed: ${JSON.stringify({ firstStatus, secondStatus, refreshCount: refreshTokens.length, refreshTokensMatchInitial: refreshTokens[0] === initialRefreshToken, tokensDiffer: refreshTokens[1] !== refreshTokens[0], uiResult })}`);
      }
      console.log('PASS: UI refresh queued behind the held WorkManager refresh and succeeded with its rotated token');
    }
    if (refreshRaceSmoke) {
      const refreshRace = await page.evaluate(async apiBaseUrl => {
        const previousToken = (await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token;
        const uiRefresh = window.Capacitor.nativePromise('SessionVault', 'refreshSession', { apiBaseUrl });
        const workerSync = window.Capacitor.nativePromise('HealthBridge', 'syncNow', {});
        const [session, queued] = await Promise.all([uiRefresh, workerSync]);
        const currentToken = (await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token;
        return { userId: session.user?.id ?? null, attemptId: queued.attemptId ?? null, tokenRotated: !!currentToken && currentToken !== previousToken };
      }, 'http://10.0.2.2:4000/api/v1');
      if (!refreshRace.userId || !refreshRace.attemptId || !refreshRace.tokenRotated) {
        throw new Error(`UI/WorkManager refresh race did not start cleanly: ${JSON.stringify(refreshRace)}`);
      }
      console.log('PASS: UI refresh rotated the Keystore token while WorkManager sync was queued');
    }
    adbRun(['shell', 'input', 'keyevent', '3']);
    const foregroundActivity = adbRun(['shell', 'dumpsys', 'activity', 'activities'])
      .split(/\r?\n/).find(line => line.includes('topResumedActivity='));
    if (!foregroundActivity || foregroundActivity.includes('com.lifetrack.app.spike')) {
      throw new Error('LifeTrack remained foregrounded after the Home action');
    }
    if (recoverySmoke) {
      await browser.close().catch(() => undefined);
      browser = null;
      adbRun(['forward', '--remove', 'tcp:9222']);
      const preKillResponse = await getWithRetry(`${api}/health/sync/status`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      const preKillConnection = (await preKillResponse.json()).data.connection;
      if (preKillConnection?.status === 'SUCCESS' && preKillConnection.lastSuccessfulSyncAt !== baselineSyncAt) {
        throw new Error('WorkManager completed before the recovery checkpoint');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (processRebootSmoke) {
        try { adbRun(['shell', 'reboot']); } catch {}
        await waitForEmulatorBoot();
        setEmulatorNetwork(false);
        emulatorNetworkDisabled = true;
        await waitForNoDefaultNetwork();
        if (launchAfterReboot) {
          adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
          await waitForAppPid();
          adbRun(['shell', 'input', 'keyevent', '3']);
          await waitForScheduledHealthJob();
          console.log('PASS: app startup re-registered persisted Health work after reboot');
        }
        const postRebootResponse = await getWithRetry(`${api}/health/sync/status`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
        const postRebootConnection = (await postRebootResponse.json()).data.connection;
        if (postRebootConnection?.status === 'SUCCESS' && postRebootConnection.lastSuccessfulSyncAt !== baselineSyncAt) {
          throw new Error('WorkManager completed before network was restored after reboot');
        }
        console.log('PASS: emulator rebooted before WorkManager reported success');
      } else {
        adbRun(['shell', 'am', 'kill', 'com.lifetrack.app.spike']);
        let processRestarted = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          try {
            const currentPid = adbRun(['shell', 'pidof', 'com.lifetrack.app.spike']);
            if (currentPid && !currentPid.split(/\s+/).includes(pid)) { processRestarted = true; break; }
          } catch { processRestarted = true; break; }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        if (!processRestarted) throw new Error('Android did not kill or restart the LifeTrack process');
        console.log('PASS: LifeTrack process was killed before WorkManager reported success');
      }
      setEmulatorNetwork(true);
      emulatorNetworkDisabled = false;
      await waitForConnectedBackendNetwork();
    }
    let connection;
    const maxWaitSeconds = recoverySmoke ? 240 : 90;
    for (let attempt = 0; attempt < maxWaitSeconds; attempt++) {
      const response = await getWithRetry(`${api}/health/sync/status`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
      connection = (await response.json()).data.connection;
      if (connection?.status === 'SUCCESS' && connection.lastSuccessfulSyncAt && connection.lastSuccessfulSyncAt !== baselineSyncAt) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (connection?.status !== 'SUCCESS' || !connection.lastSuccessfulSyncAt || connection.lastSuccessfulSyncAt === baselineSyncAt) {
      throw new Error(`WorkManager did not complete while LifeTrack was backgrounded (status=${connection?.status || 'missing'})`);
    }
    const dailySteps = await backendDailySteps(auth.accessToken);
    if (dailySteps !== 0) throw new Error(`Expected no test Steps in background smoke, received ${dailySteps}`);
    console.log('PASS: WorkManager completed a network-constrained sync while LifeTrack was backgrounded');
    if (recoverySmoke) {
      if (browser) {
        await browser.close().catch(() => undefined);
        browser = null;
        adbRun(['forward', '--remove', 'tcp:9222']);
      }
    }
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    if (recoverySmoke) {
      const restartedPid = await waitForAppPid();
      adbRun(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${restartedPid}`]);
      browser = await connectWebView();
      testPage = browser.contexts()[0].pages()[0];
      let refreshDiagnostic = null;
      testPage.on('response', async response => {
        if (!response.url().endsWith('/auth/refresh')) return;
        let message = null;
        try { message = (await response.json())?.message ?? null; } catch {}
        refreshDiagnostic = { status: response.status(), message };
      });
      testPage.on('requestfailed', request => {
        if (request.url().endsWith('/auth/refresh')) refreshDiagnostic = { networkError: request.failure()?.errorText ?? 'request failed' };
      });
      try {
        await testPage.waitForURL('**/dashboard', { timeout: 30000 });
      } catch {
        const diagnostic = await testPage.evaluate(async refreshDiagnostic => ({
          url: location.href,
          refreshTokenPresent: !!(await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {})).token,
          localTokenPresent: localStorage.getItem('pft.refreshToken') !== null,
          sync: await window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}),
          bodyText: document.body.innerText.slice(0, 240),
          refreshDiagnostic,
        }), refreshDiagnostic).catch(error => ({ evaluationError: error.message }));
        throw new Error(`App did not restore Dashboard after recovery: ${JSON.stringify(diagnostic)}`);
      }
      const restored = await testPage.evaluate(async () => ({
        refreshToken: await window.Capacitor.nativePromise('SessionVault', 'readRefreshToken', {}),
        localToken: localStorage.getItem('pft.refreshToken'),
        sync: await window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}),
      }));
      if (!restored.refreshToken.token || restored.localToken || restored.sync.connectionId !== connectionId) {
        throw new Error('Keystore session or local health connection did not survive process death');
      }
      console.log('PASS: app restored its Keystore session and connection after process death');
      await testPage.locator('a[href$="/health"]').first().click({ force: true });
      await testPage.waitForURL('**/health', { timeout: 15000 });
    }
    await testPage.getByRole('button', { name: 'Sync now', exact: true }).waitFor({ timeout: 15000 });
  } else if (!logoutRaceSmoke) {
    writerRecordExists = true;
    await runWriterAction('WRITE 1234 TEST STEPS', 'Wrote 1234 synthetic test steps');
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    await page.getByRole('button', { name: 'Sync now', exact: true }).waitFor({ timeout: 15000 });
    let syncAt = await syncAndAssertSteps(auth.accessToken, 1234, null);
    console.log('PASS: foreground Changes API sync imported 1,234 synthetic Steps');

    await runWriterAction('UPDATE TO 2345 TEST STEPS', 'Wrote 2345 synthetic test steps');
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    syncAt = await syncAndAssertSteps(auth.accessToken, 2345, syncAt);
    console.log('PASS: updated Health Connect record reached the backend as 2,345 Steps');

    await runWriterAction('DELETE TEST STEPS', 'Deleted synthetic test steps');
    writerRecordExists = false;
    adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
    await syncAndAssertSteps(auth.accessToken, 0, syncAt);
    console.log('PASS: Health Connect deletion removed the imported Steps total');
  }

  if (connectionId) {
    const disconnect = await fetch(`${api}/health/connections/${connectionId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.accessToken}` } });
    if (!disconnect.ok) throw new Error(`Backend disconnect failed (${disconnect.status})`);
    await testPage.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'disconnectHealth', {}));
    console.log('PASS: native connection cleared after foreground sync');
  }
}

main().catch(error => {
  console.error('Capacitor sync smoke failed:', error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (workerRefreshProxy) {
    workerRefreshProxy.release();
    await new Promise(resolve => workerRefreshProxy.server.close(resolve));
    workerRefreshProxy = null;
  }
  if (emulatorNetworkDisabled) {
    try {
      setEmulatorNetwork(true);
      emulatorNetworkDisabled = false;
    } catch { console.error('Emulator network restoration failed'); }
  }
  if (writerRecordExists) {
    try { await runWriterAction('DELETE TEST STEPS', 'Deleted synthetic test steps'); }
    catch { console.error('Synthetic Health Connect test record cleanup failed'); }
  }
  let disconnected = false;
  if (testPage && browser) {
    disconnected = await testPage.evaluate(async () => {
      await window.Capacitor.nativePromise('HealthBridge', 'disconnectHealth', {});
      await window.Capacitor.nativePromise('SessionVault', 'clear', {});
      localStorage.removeItem('pft.refreshToken');
      location.replace('/auth/login');
      return true;
    })
      .then(() => true).catch(() => false);
  }
  if (browser) await browser.close().catch(() => undefined);
  if (!disconnected && connectionId) {
    try {
      adbRun(['shell', 'am', 'start', '-n', 'com.lifetrack.app.spike/.MainActivity']);
      const pid = await waitForAppPid();
      adbRun(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`]);
      const cleanupBrowser = await connectWebView();
      const cleanupPage = cleanupBrowser.contexts()[0].pages()[0];
      const syncStatus = await cleanupPage.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'getSyncStatus', {}));
      if (processDeathSmoke) {
        console.log(`Native status before cleanup: ${JSON.stringify({ state: syncStatus.state, reasonCode: syncStatus.reasonCode, lastAttemptedSyncAt: syncStatus.lastAttemptedSyncAt, lastSuccessfulSyncAt: syncStatus.lastSuccessfulSyncAt })}`);
      }
      await cleanupPage.evaluate(() => window.Capacitor.nativePromise('HealthBridge', 'disconnectHealth', {}));
      await cleanupBrowser.close();
    } catch { console.error('Native health connection cleanup request failed'); }
  }
  for (const cleanupAccessToken of cleanupAccessTokens) {
    try {
      await fetch(`${api}/auth/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cleanupAccessToken}` },
        body: JSON.stringify({ password, confirmation: 'DELETE' }),
      });
    } catch { console.error('Temporary test account cleanup request failed'); }
  }
});