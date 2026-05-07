import { expect, Page } from '@playwright/test';

export type Credentials = {
  email: string;
  password: string;
};

export const runId = `${new Date().toISOString().replaceAll(/[-:.TZ]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;

export function getCredentials(): Credentials {
  const email = process.env.E2E_SUPERADMIN_EMAIL;
  const password = process.env.E2E_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Missing E2E_SUPERADMIN_EMAIL or E2E_SUPERADMIN_PASSWORD environment variables.');
  }

  return { email, password };
}

export async function gotoWithRetry(page: Page, path: string, maxAttempts = 3): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    await page.goto(path, { waitUntil: 'domcontentloaded' });

    const loaderVisible = await page.getByText('Loading...').isVisible().catch(() => false);
    if (!loaderVisible) {
      return;
    }

    await page.waitForTimeout(1000);
  }

  await expect(page.getByText('Loading...')).toBeHidden();
}

export async function loginAsSuperAdmin(page: Page): Promise<void> {
  const { email, password } = getCredentials();

  await gotoWithRetry(page, '/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard\/super-admin/);
}

export async function dismissToastIfPresent(page: Page): Promise<void> {
  const closeToast = page.getByLabel('Close').first();
  if (await closeToast.isVisible().catch(() => false)) {
    await closeToast.click();
  }
}

export function isDestructiveLabel(label: string): boolean {
  return /(delete|remove|destroy|terminate|close year|purge|reset|logout)/i.test(label);
}
