import { Page, expect } from '@playwright/test';

/** Logs in via the "Try Demo" button on the login page and waits for the app shell to load. */
export async function loginAsDemo(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.getByRole('button', { name: /try demo/i }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 15_000 });
}
