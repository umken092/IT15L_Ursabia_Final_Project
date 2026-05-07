import { expect, test } from '@playwright/test';
import { gotoWithRetry, isDestructiveLabel, loginAsSuperAdmin } from './helpers';

const modulePaths = [
  '/dashboard/super-admin',
  '/module/user-management',
  '/module/roles-permissions',
  '/module/system-settings',
  '/module/integration-settings',
  '/module/security-policy',
  '/module/fiscal-periods',
];

test.describe('Advanced gate - safe full-button crawl', () => {
  test('all module pages accept safe button actions without hard failure', async ({ page }) => {
    await loginAsSuperAdmin(page);

    for (const path of modulePaths) {
      await gotoWithRetry(page, path);

      const buttons = page.getByRole('button');
      const count = await buttons.count();
      const clickCap = Math.min(count, 40);

      for (let i = 0; i < clickCap; i += 1) {
        const btn = buttons.nth(i);
        const label = (await btn.innerText().catch(() => '')).trim();

        if (!label || isDestructiveLabel(label)) {
          continue;
        }

        const disabled = await btn.isDisabled().catch(() => true);
        if (disabled) {
          continue;
        }

        await btn.click({ timeout: 3000 }).catch(() => {
          // Buttons can become stale after route updates; skip and continue.
        });

        // Basic stability assertions after each safe action.
        await page.waitForTimeout(200);
        await expect(page.getByText('Loading...')).toBeHidden({ timeout: 5000 });
      }

      // Page should stay recoverable after crawl attempts.
      await expect(page).toHaveURL(new RegExp(path.split('#')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
