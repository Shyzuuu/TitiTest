import { expect, test } from '@playwright/test';
import { ids, openApp, resetWorld, row, triggerIncoming } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetWorld(page.request);
});

test('Test 12 — smartphone : liste dédiée, conversation plein écran, retour, citations', async ({ page }) => {
  const who = await ids(page.request);
  await openApp(page);
  const noHorizontalScroll = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // Liste dédiée, navigation du bas visible.
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toBeVisible();
  await expect(page.getByTestId('chat-view')).toHaveCount(0);
  await noHorizontalScroll();

  // Conversation plein écran : la liste et la barre du bas disparaissent, la saisie reste accessible.
  await row(page, 'Emma').click();
  await expect(page.getByTestId('chat-view')).toBeVisible();
  await expect(page.getByTestId('conversation-row').first()).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toHaveCount(0);
  await expect(page.getByTestId('info-panel')).toBeHidden();
  const composer = page.getByTestId('composer');
  await expect(composer).toBeInViewport();
  await composer.fill('Message depuis mon téléphone');
  await page.getByTestId('send-button').tap();
  const mine = page.getByTestId('message').filter({ hasText: 'Message depuis mon téléphone' });
  await expect(mine).toBeVisible();

  // Répondre à son propre message au toucher : la bulle révèle l'action « Répondre ».
  await mine.locator('div.rounded-2xl').first().tap();
  await mine.getByTestId('reply-button').tap();
  await expect(page.getByTestId('reply-preview')).toBeInViewport();
  await composer.fill('Réponse à moi-même');
  await page.getByTestId('send-button').tap();
  await expect(page.getByTestId('message').filter({ hasText: 'Réponse à moi-même' }).getByTestId('quote')).toContainText('Message depuis mon téléphone');
  await noHorizontalScroll();

  // Retour à la liste, ouverture d'une autre personne, puis retour sans perte.
  await composer.fill('brouillon mobile');
  await page.getByTestId('back-button').tap();
  await expect(page.getByTestId('conversation-row').first()).toBeVisible();
  await triggerIncoming(page.request, who('Lucas').characterId);
  await expect(row(page, 'Lucas').getByTestId('unread-badge')).toBeVisible();
  await row(page, 'Lucas').tap();
  await expect(page.getByTestId('chat-title')).toHaveText('Lucas Martin');
  await page.getByTestId('back-button').tap();
  await row(page, 'Emma').tap();
  await expect(page.getByTestId('message').filter({ hasText: 'Réponse à moi-même' })).toBeVisible();
  await expect(page.getByTestId('composer')).toHaveValue('brouillon mobile');

  // Boîte mail utilisable sans défilement horizontal.
  await page.goto('/mail/inbox');
  await expect(page.getByTestId('mail-item').first()).toBeVisible();
  await noHorizontalScroll();
  await page.getByTestId('mail-item').first().tap();
  await expect(page.getByTestId('mail-detail')).toBeVisible();
  await noHorizontalScroll();

  // Notifications accessibles depuis la barre du bas.
  await page.goto('/chats');
  await page.getByRole('navigation', { name: 'Navigation mobile' }).getByText('Notifications').tap();
  await expect(page.getByTestId('notification').first()).toBeVisible();
  await noHorizontalScroll();
});
