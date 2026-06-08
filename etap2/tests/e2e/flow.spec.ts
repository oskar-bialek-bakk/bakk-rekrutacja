import { test, expect } from '@playwright/test';

test('pełny przepływ: start → ocena → podsumowanie → zestawienie', async ({ page }) => {
  await page.goto('/');
  await page.fill('#in-name', 'Test Kandydat');
  await page.click('#btn-start');

  for (let i = 0; i < 4; i++) {
    await page.check('input[name="mark"][value="4"]');
    await page.click('#next');
  }
  await expect(page.locator('.scorebig b')).toHaveText('80');
  await page.click('.dbtn.yes');
  await page.click('#save');

  await expect(page.locator('td.name')).toContainText('Test Kandydat');
});
