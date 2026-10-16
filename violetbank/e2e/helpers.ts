import { expect, type Page } from '@playwright/test';

/** Convertit « 13 079,79 € » en centimes. */
export function toCents(text: string): number {
  const clean = text.replace(/[^\d,-]/g, '');
  const [i = '0', d = '00'] = clean.split(',');
  return Number(i) * 100 + Number(d.padEnd(2, '0').slice(0, 2));
}

export async function mainBalance(page: Page): Promise<number> {
  const el = page.getByTestId('main-balance');
  await expect(el).toBeVisible();
  return toCents((await el.textContent()) ?? '');
}

/** Démarre sur un état vide et déterministe via la page de réinitialisation. */
export async function resetToEmpty(page: Page) {
  await page.goto('/reinitialisation');
  await page.getByRole('button', { name: 'Réinitialiser' }).click();
  await page.getByLabel('Saisissez EFFACER pour confirmer').fill('EFFACER');
  await page.getByRole('dialog').getByRole('button', { name: 'Effacer' }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function addFunds(page: Page, amount: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter de l’argent fictif' });
  await dialog.getByLabel('Montant').fill(amount);
  await dialog.getByRole('button', { name: 'Confirmer l’ajout' }).click();
  await expect(dialog.getByText('Fonds de test ajoutés')).toBeVisible();
  await dialog.getByRole('button', { name: 'Terminé' }).click();
}
