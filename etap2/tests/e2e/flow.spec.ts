import { test, expect } from '@playwright/test';

test('pełny przepływ: start → ocena → podsumowanie → zestawienie', async ({ page }) => {
  // Zakończenie oceny bez notatek pokazuje confirm — akceptujemy go.
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.fill('#in-name', 'Test Kandydat');
  await page.click('#btn-start');

  for (let i = 0; i < 4; i++) {
    await page.click('label.lvl[data-lvl="4"]');
    await page.click('#next');
  }
  await expect(page.locator('.scorebig b')).toHaveText('80');
  await page.click('.dbtn.yes');
  await page.click('#save');

  await expect(page.locator('td.name')).toContainText('Test Kandydat');
});

test('szczegóły kandydata: otwarcie, edycja i powrót do zestawienia', async ({ page }) => {
  // Zakończenie oceny bez notatek pokazuje confirm — akceptujemy go.
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.fill('#in-name', 'Detal Kandydat');
  await page.click('#btn-start');

  for (let i = 0; i < 4; i++) {
    await page.click('label.lvl[data-lvl="4"]');
    await page.click('#next');
  }
  await page.click('.dbtn.yes');
  await page.click('#save');

  // Jesteśmy na zestawieniu; otwórz szczegóły klikając komórkę z nazwą kandydata.
  await page.click('tr.row-link td.name:has-text("Detal Kandydat")');

  // Ekran szczegółów: nazwa i wynik widoczne.
  await expect(page.locator('#detail-name')).toHaveText('Detal Kandydat');
  await expect(page.locator('#detail-score')).toHaveText('80');

  // Edytuj → powrót do oceny (stepper widoczny).
  await page.click('#edit');
  await expect(page.locator('.stepper')).toBeVisible();

  // Przejdź przez bloki do podsumowania i zapisz, by wrócić na zestawienie.
  for (let i = 0; i < 4; i++) {
    await page.click('#next');
  }
  await expect(page.locator('.scorebig b')).toBeVisible();
  await page.click('#save');

  // Otwórz szczegóły ponownie i wróć przyciskiem do zestawienia.
  await page.click('tr.row-link td.name:has-text("Detal Kandydat")');
  await page.click('#back');
  await expect(page.locator('td.name')).toContainText('Detal Kandydat');
});
