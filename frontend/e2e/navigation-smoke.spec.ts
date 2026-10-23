import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth';

const majorRoutes = [
  '/dashboard',
  '/transactions',
  '/expenses',
  '/income',
  '/banks',
  '/credit-cards',
  '/business',
  '/reports',
  '/investments',
  '/stocks',
  '/crypto',
  '/mutual-funds',
  '/fd/calculator',
  '/fd/portfolio',
  '/investment-comparison',
  '/goals',
  '/upcoming-bills',
  '/calendar',
  '/family-members',
  '/calculators',
  '/health',
  '/tax',
  '/ai-insights',
  '/financial-health',
  '/analytics',
  '/notifications',
  '/support-tickets',
  '/settings',
] as const;

test('major navigation entries resolve without auth redirects', async ({ page }) => {
  await loginAsDemo(page);

  for (const route of majorRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/auth\/login/);
  }
});

test('landing feature cards and pricing match implemented modules and plan guards', async ({ page }) => {
  await page.goto('/');

  const features = page.locator('#features');
  await expect(features.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await expect(features.getByRole('heading', { name: 'Business Operations' })).toBeVisible();
  await expect(features.getByRole('heading', { name: 'Tax Planning' })).toBeVisible();
  await expect(features.getByRole('heading', { name: 'Android App (In Development)' })).toBeVisible();

  const pricing = page.locator('#pricing');
  await expect(pricing.getByText('Prices are indicative. Paid plans are not available to purchase yet.')).toBeVisible();
  await expect(pricing.getByRole('button', { name: 'Coming soon' })).toHaveCount(2);
  await expect(pricing.getByRole('link', { name: 'Start Plus' })).toHaveCount(0);
  const analyticsRow = pricing.locator('tbody tr').filter({ has: page.getByRole('cell', { name: 'Analytics', exact: true }) });
  await expect(analyticsRow.locator('td').nth(1)).toHaveText('—');
  await expect(analyticsRow.locator('td').nth(2)).toHaveText('✓');

  const independenceRow = pricing.locator('tbody tr').filter({ has: page.getByRole('cell', { name: 'Financial Independence Planning', exact: true }) });
  await expect(independenceRow.locator('td').nth(1)).toHaveText('—');
  await expect(independenceRow.locator('td').nth(2)).toHaveText('✓');
  await expect(pricing.getByText('Advanced Forecasting', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Can I cancel a paid plan?' }).click();
  await expect(page.getByText('Paid-plan checkout is not available yet, so no paid plan can currently be purchased or cancelled.')).toBeVisible();
  await page.getByRole('button', { name: 'Is the Android app available?' }).click();
  await expect(page.getByText('The Android app is in development. A public Google Play release is not available yet.')).toBeVisible();
});

test('updated finance screens fit phone and desktop widths with named icon actions', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('admin@financetracker.local');
  await page.getByLabel('Password').fill('Admin@1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });

  const auditRoutes = ['/transactions', '/banks', '/analytics', '/business/journal-approvals', '/fd/portfolio'];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    for (const route of auditRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => window.location.pathname)).toBe(route);

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth, `${route} overflows at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);

      const unnamedButtons = await page.locator('main button:visible').evaluateAll((buttons) =>
        buttons
          .filter((button) => {
            const control = button as HTMLButtonElement;
            if (control.getAttribute('aria-label')?.trim() || control.title.trim()) return false;
            const copy = control.cloneNode(true) as HTMLButtonElement;
            copy.querySelectorAll('mat-icon, svg').forEach((icon) => icon.remove());
            return !copy.textContent?.replace(/\s+/g, ' ').trim();
          })
          .map((button) => button.outerHTML.slice(0, 180))
      );
      expect(unnamedButtons, `${route} has icon-only buttons without accessible names`).toEqual([]);
    }
  }
});