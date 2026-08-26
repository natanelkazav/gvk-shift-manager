import { test, expect } from '@playwright/test';

const roleCases = [
  {
    name: 'manager',
    emailEnv: 'GVK_TEST_MANAGER_EMAIL',
    passwordEnv: 'GVK_TEST_MANAGER_PASSWORD',
    paths: ['/', '/schedule', '/statistics', '/users', '/settings'],
  },
  {
    name: 'dispatcher',
    emailEnv: 'GVK_TEST_DISPATCHER_EMAIL',
    passwordEnv: 'GVK_TEST_DISPATCHER_PASSWORD',
    paths: ['/', '/schedule', '/availability', '/shift-swaps', '/notifications'],
  },
  {
    name: 'on-call driver',
    emailEnv: 'GVK_TEST_DRIVER_EMAIL',
    passwordEnv: 'GVK_TEST_DRIVER_PASSWORD',
    paths: ['/', '/driver-schedule'],
  },
  {
    name: 'morning driver',
    emailEnv: 'GVK_TEST_MORNING_DRIVER_EMAIL',
    passwordEnv: 'GVK_TEST_MORNING_DRIVER_PASSWORD',
    paths: ['/', '/morning-driver-schedule', '/morning-driver-availability'],
  },
];

async function login(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('כתובת אימייל').fill(email);
  await page.getByLabel('סיסמה').fill(password);
  await page.getByRole('button', { name: 'כניסה למערכת' }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
}

for (const roleCase of roleCases) {
  test(`${roleCase.name}: login and permitted pages do not crash`, async ({ page }) => {
    const email = process.env[roleCase.emailEnv];
    const password = process.env[roleCase.passwordEnv];
    test.skip(!email || !password, `Missing ${roleCase.emailEnv}/${roleCase.passwordEnv}`);

    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page, email, password);

    for (const route of roleCase.paths) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText('missing FROM-clause entry');
      await expect(page.locator('body')).not.toContainText('does not exist | Code:');
      await expect(page.locator('body')).not.toContainText('לא ניתן היה לטעון');
    }

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });
}
