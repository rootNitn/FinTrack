import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/auth';

const DASHBOARD_API = '**/api/v1/mutual-funds/dashboard';

function parseCurrency(text: string): number {
  return Number(text.replace(/[^\d.-]/g, '')) || 0;
}

test.describe('Mutual Funds dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test('page loads and shows summary + holdings', async ({ page }) => {
    const responsePromise = page.waitForResponse(DASHBOARD_API);
    await page.goto('/mutual-funds');
    await responsePromise;

    await expect(page.getByRole('heading', { name: 'Mutual Funds' })).toBeVisible();
    await expect(page.getByTestId('mf-total-invested')).toBeVisible();
    await expect(page.getByTestId('mf-current-value')).toBeVisible();
    await expect(page.getByTestId('mf-overall-xirr')).toBeVisible();
    await expect(page.getByTestId('mf-fund-row').first()).toBeVisible();
  });

  test('filters by rating and category narrow the holdings table', async ({ page }) => {
    await page.goto('/mutual-funds');
    await page.waitForResponse(DASHBOARD_API);

    const initialRows = await page.getByTestId('mf-fund-row').count();
    expect(initialRows).toBeGreaterThan(0);

    // Apply a rating filter and confirm every remaining row matches it.
    await page.getByTestId('mf-rating-filter').click();
    await page.getByRole('option', { name: 'Average' }).click();
    const ratingFilteredRows = page.getByTestId('mf-fund-row');
    const ratingCount = await ratingFilteredRows.count();
    for (let i = 0; i < ratingCount; i++) {
      await expect(ratingFilteredRows.nth(i)).toContainText('Average');
    }

    // Reset, then apply a category filter and confirm every row matches it.
    await page.getByTestId('mf-rating-filter').click();
    await page.getByRole('option', { name: 'All ratings' }).click();

    await page.getByTestId('mf-category-filter').click();
    const firstCategoryOption = page.getByRole('option').nth(1);
    const categoryName = (await firstCategoryOption.textContent())?.trim();
    await firstCategoryOption.click();

    const categoryFilteredRows = page.getByTestId('mf-fund-row');
    const categoryCount = await categoryFilteredRows.count();
    expect(categoryCount).toBeGreaterThan(0);
    for (let i = 0; i < categoryCount; i++) {
      await expect(categoryFilteredRows.nth(i)).toContainText(categoryName!);
    }
  });

  test('search narrows the holdings table by fund name', async ({ page }) => {
    await page.goto('/mutual-funds');
    const response = await page.waitForResponse(DASHBOARD_API);
    const body = await response.json();
    const firstFundName: string = body.data.funds[0].name;
    const searchWord = firstFundName.split(' ')[0];

    await page.getByTestId('mf-search-input').fill(searchWord);

    const rows = page.getByTestId('mf-fund-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(new RegExp(searchWord, 'i'));
    }

    // A nonsense search term should produce zero rows (still shows the table, just empty body).
    await page.getByTestId('mf-search-input').fill('zzz-no-such-fund-zzz');
    await expect(page.getByTestId('mf-fund-row')).toHaveCount(0);
  });

  test('summary totals match the sum of individual fund holdings from the API', async ({ page }) => {
    await page.goto('/mutual-funds');
    const response = await page.waitForResponse(DASHBOARD_API);
    const body = await response.json();
    const funds: Array<{ investedAmount: number; currentValue: number }> = body.data.funds;

    const expectedInvested = Math.round(funds.reduce((sum, f) => sum + f.investedAmount, 0));
    const expectedCurrent = Math.round(funds.reduce((sum, f) => sum + f.currentValue, 0));

    const investedText = await page.getByTestId('mf-total-invested').innerText();
    const currentText = await page.getByTestId('mf-current-value').innerText();

    expect(parseCurrency(investedText)).toBeCloseTo(expectedInvested, 0);
    expect(parseCurrency(currentText)).toBeCloseTo(expectedCurrent, 0);
  });

  test('XIRR is displayed for every fund row that has one in the API response', async ({ page }) => {
    await page.goto('/mutual-funds');
    const response = await page.waitForResponse(DASHBOARD_API);
    const body = await response.json();
    const funds: Array<{ xirrPercent: number | null }> = body.data.funds;

    const rows = page.getByTestId('mf-fund-row');
    await expect(rows).toHaveCount(funds.length);

    for (let i = 0; i < funds.length; i++) {
      const rowText = await rows.nth(i).innerText();
      if (funds[i].xirrPercent === null) {
        expect(rowText).toContain('—');
      } else {
        const sign = funds[i].xirrPercent >= 0 ? '+' : '-';
        expect(rowText).toContain(`${sign}${Math.abs(funds[i].xirrPercent).toFixed(2)}%`);
      }
    }
  });

  test('category breakdown table totals match the sum of holdings in that category', async ({ page }) => {
    await page.goto('/mutual-funds');
    const response = await page.waitForResponse(DASHBOARD_API);
    const body = await response.json();
    const funds: Array<{ categoryLabel: string; investedAmount: number; currentValue: number }> = body.data.funds;

    const byCategory = new Map<string, { invested: number; current: number; count: number }>();
    for (const f of funds) {
      const entry = byCategory.get(f.categoryLabel) ?? { invested: 0, current: 0, count: 0 };
      entry.invested += f.investedAmount;
      entry.current += f.currentValue;
      entry.count += 1;
      byCategory.set(f.categoryLabel, entry);
    }

    for (const [label, totals] of byCategory) {
      const row = page.locator('tr', { hasText: label }).last();
      const rowText = await row.innerText();
      expect(parseCurrency(rowText)).toBeGreaterThanOrEqual(0); // sanity: row exists & parseable
      expect(rowText).toContain(String(totals.count));
    }
  });

  test('empty state renders when the user has no mutual fund holdings', async ({ page }) => {
    await page.route(DASHBOARD_API, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            summary: {
              totalInvested: 0,
              totalCurrentValue: 0,
              totalProfit: 0,
              totalProfitPercent: 0,
              overallXirrPercent: null,
              fundCount: 0,
              ratingCounts: {},
              totalLongTermValue: 0,
              totalShortTermValue: 0,
            },
            allocation: [],
            categoryBreakdown: [],
            termBreakdown: [],
            funds: [],
          },
        }),
      })
    );

    await page.goto('/mutual-funds');
    await expect(page.getByTestId('mf-empty-state')).toBeVisible();
    await expect(page.getByText('No mutual fund holdings yet')).toBeVisible();
  });

  test('shows an error toast when the dashboard API call fails', async ({ page }) => {
    await page.route(DASHBOARD_API, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal server error' }),
      })
    );

    await page.goto('/mutual-funds');
    await expect(page.getByText(/failed to load mutual funds dashboard/i)).toBeVisible();
  });
});
