import { expect, test } from '@playwright/test';

test('main menu renders title and primary controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FIREPILOT' })).toBeVisible();
  await expect(page.getByText('FLAP WAR', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'LAUNCH' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SETTINGS' })).toBeVisible();
});
