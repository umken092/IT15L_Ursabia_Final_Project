import { expect, test } from '@playwright/test';
import { dismissToastIfPresent, gotoWithRetry, loginAsSuperAdmin, runId } from './helpers';

test.describe('Save and refresh persistence regressions', () => {
  test.beforeAll(async () => {
    test.skip(
      !process.env.E2E_SUPERADMIN_EMAIL || !process.env.E2E_SUPERADMIN_PASSWORD,
      'Skipping: E2E_SUPERADMIN_EMAIL or E2E_SUPERADMIN_PASSWORD not configured.',
    );
  });

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('user management: create employee persists after refresh', async ({ page }) => {
    const firstName = `E2E${runId.slice(0, 6)}`;
    const middleName = 'Persist';
    const lastName = `Create${runId.slice(-4)}`;
    const fullName = `${firstName} ${middleName} ${lastName}`;

    await gotoWithRetry(page, '/module/user-management');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Employee Account' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Kendo React <Input> is a controlled component: fill() sets the DOM value but does
    // NOT trigger Kendo's InputChangeEvent → React state stays empty.  pressSequentially()
    // fires real keyboard events that Kendo translates to InputChangeEvent → state updates.
    await page.locator('#create-first-name').pressSequentially(firstName);
    await page.locator('#create-middle-name').pressSequentially(middleName);
    await page.locator('#create-last-name').pressSequentially(lastName);

    // Native <input type="date"> — fill() works and fires the native onChange that
    // handleBirthdateChange listens to.  Fill this AFTER Kendo fields so the resulting
    // React re-render sees firstName/lastName already in state.
    await page.locator('#create-birthdate').fill('1997-03-14');
    // Age auto-computes from birthdate; do not fill separately to avoid conflicts.

    // Kendo TextArea for address
    await page.locator('#create-address').pressSequentially('123 E2E Street');

    // Kendo MaskedTextBox: type only the digit chars; mask inserts separators automatically
    await page.locator('#create-tin').pressSequentially('123456789000');
    await page.locator('#create-sss').pressSequentially('1234567890');

    // Kendo Input for department
    await page.locator('#create-department').pressSequentially('Finance');

    await page.getByRole('button', { name: 'Save Employee' }).click();
    // Dialog closes only when the save API call succeeds
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 30000 });

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByPlaceholder('Search by name or email').fill(firstName);
    await expect(page.getByRole('row', { name: new RegExp(fullName, 'i') })).toBeVisible({ timeout: 15000 });
  });

  test('user management: edit employee persists after refresh', async ({ page }) => {
    // Create a fresh employee in-test to avoid any dependency on demo/seed data.
    const firstName = `E2EEdit${runId.slice(0, 4)}`;
    const lastName = `Target${runId.slice(-4)}`;
    const originalDepartment = 'Finance';
    const newDepartment = `Finance-QA-${runId.slice(-4)}`;

    // Step 1: create the employee
    await gotoWithRetry(page, '/module/user-management');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create Employee Account' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    await page.locator('#create-first-name').pressSequentially(firstName);
    await page.locator('#create-last-name').pressSequentially(lastName);
    await page.locator('#create-birthdate').fill('1990-06-15');
    await page.locator('#create-address').pressSequentially('456 Edit Ave');
    await page.locator('#create-tin').pressSequentially('111222333000');
    await page.locator('#create-sss').pressSequentially('1112223330');
    await page.locator('#create-department').pressSequentially(originalDepartment);

    await page.getByRole('button', { name: 'Save Employee' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 30000 });

    // Step 2: search for and edit that employee
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByPlaceholder('Search by name or email').fill(firstName);

    const userRow = page.getByRole('row', { name: new RegExp(firstName, 'i') });
    await expect(userRow).toBeVisible({ timeout: 15000 });
    await userRow.getByRole('button', { name: 'Edit' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    await page.locator('#edit-department').click({ clickCount: 3 });
    await page.locator('#edit-department').pressSequentially(newDepartment);

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 30000 });

    // Step 3: reload and verify the department change persisted
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByPlaceholder('Search by name or email').fill(firstName);
    await expect(
      page.getByRole('row', { name: new RegExp(firstName, 'i') }).getByRole('cell', { name: newDepartment }),
    ).toBeVisible({ timeout: 15000 });
  });

  // DEFECT: IntegrationSettingsModule.handleSaveSmtp() is a fake save — it does a
  // simulated 700 ms timeout and shows a success toast but makes NO API call and has
  // no backend endpoint. SMTP state lives only in React component state and resets to
  // INITIAL_SMTP (fromName: 'CMNetwork') on every page load.
  // Fix required: implement GET/PUT /api/admin/smtp-settings + wire the frontend.
  test.fixme('integration settings: smtp from name persists after refresh', async ({ page }) => {
    const value = `CMNetwork QA ${runId.slice(-6)}`;

    await gotoWithRetry(page, '/module/integration-settings');
    await page.getByLabel('From Name').fill(value);

    await page.getByRole('button', { name: 'Save' }).nth(1).click();
    await expect(page.getByText('SMTP settings saved.')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('From Name')).toHaveValue(value);
  });

  // DEFECT: RolesPermissionsModule.handleSavePerms() is a fake save — it does a
  // simulated 700 ms timeout and shows a success toast but makes NO API call.
  // The comment in the source reads: "Simulated API call — wire to backend when claims
  // endpoint is ready". Permissions live only in React state and reset on page reload.
  // Fix required: implement GET/PUT /api/admin/roles/{role}/permissions + wire the frontend.
  test.fixme('roles permissions: checkbox state persists after refresh', async ({ page }) => {
    await gotoWithRetry(page, '/module/roles-permissions');

    await page.getByRole('button', { name: 'Permissions' }).nth(1).click();
    const checkbox = page.locator('tr', { hasText: 'User Management' }).locator('input[type="checkbox"]').first();

    const original = await checkbox.isChecked();
    await checkbox.click();
    await page.getByRole('button', { name: 'Save Permissions' }).click();
    await expect(page.getByText(/permissions saved|saved/i)).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Permissions' }).nth(1).click();
    const afterRefresh = await page.locator('tr', { hasText: 'User Management' }).locator('input[type="checkbox"]').first().isChecked();

    expect(afterRefresh).toBe(!original);

    // Restore the original state so this test can run repeatedly.
    if (afterRefresh !== original) {
      const restore = page.locator('tr', { hasText: 'User Management' }).locator('input[type="checkbox"]').first();
      await restore.click();
      await page.getByRole('button', { name: 'Save Permissions' }).click();
      await dismissToastIfPresent(page);
    }
  });

  test('security policy: toggle persists and can be restored', async ({ page }) => {
    await gotoWithRetry(page, '/module/security-policy');
    // Wait for the security policy API call to finish — the component sets dirty=false
    // once loadPolicy() resolves, so clicking the switch before that completes causes a
    // race condition where dirty gets reset to false and Save Policy stays disabled.
    await page.waitForLoadState('networkidle');

    const singleSessionSwitch = page.getByRole('switch', {
      name: 'Allow only one active session per user (force sign-out on new login)',
    });
    const originalChecked = (await singleSessionSwitch.getAttribute('aria-checked')) === 'true';

    await singleSessionSwitch.click();
    await page.getByRole('button', { name: 'Save Policy' }).click();
    await expect(page.getByText(/Security policy saved/i)).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    const persisted =
      (await page
        .getByRole('switch', {
          name: 'Allow only one active session per user (force sign-out on new login)',
        })
        .getAttribute('aria-checked')) === 'true';

    expect(persisted).toBe(!originalChecked);

    const restoreSwitch = page.getByRole('switch', {
      name: 'Allow only one active session per user (force sign-out on new login)',
    });
    await restoreSwitch.click();

    // Cleanup should not fail the regression assertion if no pending changes exist.
    const savePolicyButton = page.getByRole('button', { name: 'Save Policy' });
    if (await savePolicyButton.isEnabled()) {
      await savePolicyButton.click();
      await expect(page.getByText(/Security policy saved/i)).toBeVisible();
    }
  });

  test('fiscal periods: close/open transition persists and can be restored', async ({ page }) => {
    await gotoWithRetry(page, '/module/fiscal-periods');

    const marchCard = page.locator('div', { hasText: 'March' }).first();
    const closeButton = marchCard.getByRole('button', { name: 'Close' }).first();
    const openButton = marchCard.getByRole('button', { name: 'Open' }).first();

    const wasOpen = await closeButton.isVisible().catch(() => false);

    if (wasOpen) {
      await closeButton.click();
      await expect(marchCard.getByRole('button', { name: 'Open' }).first()).toBeVisible();
    } else {
      await openButton.click();
      await expect(marchCard.getByRole('button', { name: 'Close' }).first()).toBeVisible();
    }

    await page.reload({ waitUntil: 'domcontentloaded' });

    const refreshedCard = page.locator('div', { hasText: 'March' }).first();
    if (wasOpen) {
      await expect(refreshedCard.getByRole('button', { name: 'Open' }).first()).toBeVisible();
      await refreshedCard.getByRole('button', { name: 'Open' }).first().click();
      await expect(refreshedCard.getByRole('button', { name: 'Close' }).first()).toBeVisible();
    } else {
      await expect(refreshedCard.getByRole('button', { name: 'Close' }).first()).toBeVisible();
      await refreshedCard.getByRole('button', { name: 'Close' }).first().click();
      await expect(refreshedCard.getByRole('button', { name: 'Open' }).first()).toBeVisible();
    }
  });
});
