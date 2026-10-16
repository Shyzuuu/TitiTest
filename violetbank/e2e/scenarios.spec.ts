import { expect, test } from '@playwright/test';
import { addFunds, mainBalance, resetToEmpty, toCents } from './helpers';

test.describe('Scénario A — opération fictive', () => {
  test('ajout de 100 €, persistance après actualisation, présence dans l’historique', async ({ page }) => {
    await page.goto('/');
    const before = await mainBalance(page);
    await addFunds(page, '100');
    expect(await mainBalance(page)).toBe(before + 10_000);
    await page.reload();
    expect(await mainBalance(page)).toBe(before + 10_000);
    await page.goto('/historique');
    await expect(page.getByRole('button', { name: /Ajout de fonds de test/ }).first()).toBeVisible();
    await expect(page.getByText('+100,00 €').first()).toBeVisible();
  });
});

test.describe('Scénario B — carte de démonstration', () => {
  test('créer, renommer, verrouiller (dépense bloquée), déverrouiller, persister', async ({ page }) => {
    await page.goto('/cartes');
    await page.getByRole('button', { name: 'Nouvelle carte' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom de la carte').fill('Carte E2E');
    await dialog.getByRole('button', { name: 'Thème Violet' }).click();
    await dialog.getByRole('button', { name: 'Créer la carte' }).click();
    await expect(page.getByText('Carte « Carte E2E » créée.')).toBeVisible();

    // La nouvelle carte est la dernière du carrousel.
    await page.getByRole('button', { name: /^Carte \d+$/ }).last().click();
    await expect(page.getByRole('heading', { name: 'Carte E2E' })).toBeVisible();
    await page.getByRole('button', { name: 'Modifier', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom de la carte').fill('Carte E2E renommée');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('heading', { name: 'Carte E2E renommée' })).toBeVisible();

    await page.getByRole('button', { name: 'Verrouiller' }).click();
    await expect(page.getByText('Verrouillée', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Dépense', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Simuler une dépense' });
    await dialog.getByLabel('Montant').fill('12,50');
    await dialog.getByLabel('Commerçant / libellé').fill('Test verrou');
    await dialog.getByRole('button', { name: 'Simuler le paiement' }).click();
    await expect(dialog.getByRole('alert')).toContainText('verrouillée');
    await dialog.getByRole('button', { name: 'Fermer' }).first().click();

    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^Carte \d+$/ }).last().click();
    await expect(page.getByRole('heading', { name: 'Carte E2E renommée' })).toBeVisible();
  });
});

test.describe('Scénarios C à F — cycle complet d’un prêt fictif', () => {
  test('demande, décision, activation unique, remboursement, doublon bloqué, solde total', async ({ page }) => {
    await resetToEmpty(page);
    await addFunds(page, '500');
    expect(await mainBalance(page)).toBe(50_000);

    // C — demande 1 000 € / 12 mois / 6 %
    await page.goto('/prets/nouvelle?produit=prd_custom');
    await page.getByLabel('Montant fictif souhaité').fill('1000');
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('radio', { name: '12 mois' }).click();
    await expect(page.getByTestId('wizard-payment')).toHaveText(/86,07/);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(page.getByText('1 032,80 €')).toBeVisible();
    await expect(page.getByText('32,80 €').first()).toBeVisible();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('checkbox').check();
    await page.getByTestId('submit-application').click();
    await expect(page.getByText('Demande acceptée dans la simulation')).toBeVisible({ timeout: 10_000 });
    const reference = (await page.locator('dd span.font-mono').first().textContent())?.trim() ?? '';
    expect(reference).toMatch(/^DOS-/);

    // D — activation : capital crédité une seule fois malgré un double-clic
    await page.getByTestId('activate-loan').click();
    await page.getByTestId('confirm-activation').dblclick();
    await expect(page.getByText(/Prêt fictif PRT-\w+ actif/)).toBeVisible();
    await page.getByRole('button', { name: 'Ouvrir la fiche du prêt' }).click();
    await expect(page.getByTestId('loan-outstanding')).toHaveText(/1\s000,00/);
    await page.goto('/');
    expect(await mainBalance(page)).toBe(150_000);
    await page.goto('/historique');
    await expect(page.getByRole('button', { name: /Prêt fictif PRT-/ })).toHaveCount(1);
    await page.goto('/journal');
    await page.getByRole('radio', { name: /Événements de prêts/ }).click();
    await expect(page.getByText(reference).first()).toBeVisible();

    // Persistance après actualisation
    await page.goto('/prets/mes-prets');
    await page.reload();
    await expect(page.getByRole('link', { name: /Prêt personnalisable/ }).getByText('Actif dans la simulation')).toBeVisible();
    await page.getByRole('link', { name: /Prêt personnalisable/ }).first().click();

    // E — remboursement de l'échéance n°1 (double-clic sur la confirmation)
    await page.getByTestId('pay-installment').click();
    await expect(page.getByText('86,07 €').first()).toBeVisible();
    await page.getByTestId('confirm-repayment').dblclick();
    await expect(page.getByText('Remboursement fictif effectué')).toBeVisible();
    await expect(page.getByText('918,93 €')).toBeVisible();
    await page.getByRole('button', { name: 'Voir le prêt' }).click();
    await expect(page.getByTestId('loan-outstanding')).toHaveText(/918,93/);
    await page.getByRole('radio', { name: /Remboursements \(1\)/ }).click();
    await expect(page.getByText('capital 81,07 € · intérêts 5,00 €', { exact: false })).toBeVisible();
    await page.getByRole('radio', { name: 'Tableau d’amortissement' }).click();
    await expect(page.getByText('Payée dans la simulation').first()).toBeVisible();
    await page.goto('/');
    expect(await mainBalance(page)).toBe(150_000 - 8_607);

    // F — remboursement intégral
    await page.goto('/prets/mes-prets');
    await page.getByRole('link', { name: /Prêt personnalisable/ }).first().click();
    await page.getByRole('button', { name: 'Solder' }).click();
    // Solde total = capital restant (aucune échéance arrivée à terme, intérêts futurs non dus).
    await expect(page.locator('dd').filter({ hasText: '918,93' }).first()).toBeVisible();
    await page.getByTestId('confirm-repayment').click();
    await expect(page.getByText('Prêt remboursé intégralement dans la simulation')).toBeVisible();
    await page.getByRole('button', { name: 'Voir le prêt' }).click();
    await expect(page.getByTestId('loan-outstanding')).toHaveText(/0,00/);
    await expect(page.getByText('Remboursé intégralement dans la simulation').first()).toBeVisible();
    await expect(page.getByText('Soldée par anticipation').first()).toBeVisible();
    await page.goto('/');
    expect(await mainBalance(page)).toBe(150_000 - 8_607 - 91_893);
  });
});

test.describe('Scénario G — erreurs et cohérence', () => {
  test('montants invalides, solde insuffisant, double-clic, actualisation', async ({ page }) => {
    await resetToEmpty(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter de l’argent fictif' });
    const input = dialog.getByLabel('Montant');
    const confirm = dialog.getByRole('button', { name: 'Confirmer l’ajout' });
    await input.fill('0');
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('supérieur à zéro');
    await input.fill('-5abc');
    await expect(input).toHaveValue('5');
    await input.fill('99999999');
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('Montant maximum');
    await input.fill('12,345');
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('Deux décimales');
    // Double-clic : une seule opération enregistrée.
    await input.fill('40');
    await confirm.dblclick();
    await expect(dialog.getByText('Fonds de test ajoutés')).toBeVisible();
    await dialog.getByRole('button', { name: 'Terminé' }).click();
    expect(await mainBalance(page)).toBe(4_000);

    // Retrait supérieur au solde refusé
    await page.goto('/comptes');
    await page.getByRole('button', { name: 'Retirer' }).click();
    const w = page.getByRole('dialog', { name: 'Retirer de l’argent fictif' });
    await w.getByLabel('Montant').fill('41');
    await w.getByRole('button', { name: 'Continuer' }).click();
    await expect(w.getByRole('alert')).toContainText('Solde insuffisant');
    await w.getByRole('button', { name: 'Fermer' }).click();

    // Remboursement avec solde insuffisant : prêt activé puis compte vidé
    await page.goto('/prets/nouvelle?produit=prd_small&montant=20000&duree=6');
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Continuer' }).click();
    await page.getByRole('checkbox').check();
    await page.getByTestId('submit-application').click();
    await page.getByTestId('activate-loan').click();
    await page.getByTestId('confirm-activation').click();
    await page.getByRole('button', { name: 'Ouvrir la fiche du prêt' }).click();
    const loanUrl = page.url();
    await page.goto('/comptes');
    await page.getByRole('button', { name: 'Retirer' }).click();
    await w.getByLabel('Montant').fill('240');
    await w.getByRole('button', { name: 'Continuer' }).click();
    await w.getByRole('button', { name: 'Confirmer' }).click();
    await expect(w.getByText('Retrait enregistré')).toBeVisible();
    await w.getByRole('button', { name: 'Terminé' }).click();
    await page.goto(loanUrl);
    await page.getByTestId('pay-installment').click();
    await expect(page.getByText('Solde insuffisant sur ce compte de simulation.')).toBeVisible();
    await page.getByTestId('confirm-repayment').click();
    await expect(page.getByRole('alert').filter({ hasText: 'Solde insuffisant' }).first()).toBeVisible();

    // Actualisation en cours de navigation : données cohérentes
    await page.goto('/prets/simulateur');
    await page.reload();
    await page.goto('/');
    expect(await mainBalance(page)).toBe(0);
    await page.goto('/historique');
    const net = await page.locator('header').getByText(/solde net/).textContent();
    expect(toCents(net?.split('solde net')[1] ?? '')).toBe(0);
  });
});
