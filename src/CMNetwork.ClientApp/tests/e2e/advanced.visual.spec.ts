import { expect, test } from '@playwright/test';
import { gotoWithRetry, loginAsSuperAdmin } from './helpers';

const visualPages = [
  { path: '/dashboard/super-admin', name: 'dashboard-super-admin' },
  { path: '/module/user-management', name: 'module-user-management' },
  { path: '/module/system-settings', name: 'module-system-settings' },
  { path: '/module/security-policy', name: 'module-security-policy' },
  { path: '/module/fiscal-periods', name: 'module-fiscal-periods' },
];

test.describe('Advanced gate - visual regressions with tolerant thresholds', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const item of visualPages) {
    test(`visual snapshot: ${item.name}`, async ({ page, browserName }) => {
      await gotoWithRetry(page, item.path);

      await expect(page).toHaveScreenshot(`${item.name}-${browserName}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.05,
      });
    });
  }
});
