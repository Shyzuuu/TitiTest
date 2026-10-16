import { expect, test } from '@playwright/test';

const PAGES = ['/', '/comptes', '/cartes', '/historique', '/envoyer', '/recevoir', '/virements', '/contacts', '/prets', '/prets/mes-prets', '/prets/demandes', '/prets/nouvelle', '/prets/calendrier', '/prets/simulateur', '/prets/comparateur', '/prets/remboursement', '/coffres', '/budgets', '/statistiques', '/notifications', '/profil', '/parametres', '/aide', '/journal', '/reinitialisation'];

test('aucune page ne déborde horizontalement sur mobile et aucune erreur JS', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('main h1, main [data-testid=main-balance]').first()).toBeVisible();
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `débordement sur ${path}`).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(page.getByText('Simulation bancaire — argent et crédits fictifs', { exact: false }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('navigation mobile : menu « Plus » et actions rapides', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('button', { name: 'Toutes les rubriques' }).click();
  await page.getByRole('dialog', { name: 'Toutes les rubriques' }).getByRole('link', { name: 'Budgets' }).click();
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('link', { name: 'Crédit' }).click();
  await expect(page.getByRole('heading', { name: 'Prêts fictifs' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('link', { name: 'Accueil' }).click();
  await page.getByRole('button', { name: 'Rechercher' }).click();
  await page.getByLabel('Terme recherché').fill('Lina');
  await expect(page.getByRole('dialog', { name: 'Rechercher' }).getByText('Lina Moreau').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Actions rapides' }).click();
  await page.getByRole('dialog', { name: 'Actions rapides' }).getByRole('button', { name: 'Simuler une dépense' }).click();
  await expect(page.getByRole('dialog', { name: 'Simuler une dépense' })).toBeVisible();
});
