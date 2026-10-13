import { expect, test } from '@playwright/test';
import { HEADERS, ids, openApp, resetWorld, row, sendText, triggerIncoming } from './helpers';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await resetWorld(page.request);
});

test('Partie 23 — scénario complet de bout en bout', async ({ page }) => {
  const who = await ids(page.request);
  const emma = who('Emma');
  const lucas = who('Lucas');
  const sarah = who('Sarah');

  // J'ouvre le site et je vois plusieurs personnages.
  await openApp(page);
  await expect(page.getByTestId('conversation-row')).toHaveCount(6);

  // Emma : plusieurs messages sans attendre, puis réponse à mon propre message.
  await row(page, 'Emma').click();
  await expect(page.getByTestId('chat-title')).toHaveText('Emma Laurent');
  await sendText(page, 'Salut Emma !');
  await sendText(page, "J'ai une question.");
  await sendText(page, 'Je pense jouer ce soir.');
  const own = page.getByTestId('message').filter({ hasText: 'Je pense jouer ce soir.' });
  await own.hover();
  await own.getByTestId('reply-button').click();
  await expect(page.getByTestId('reply-preview')).toContainText('Réponse à votre message');
  await expect(page.getByTestId('reply-preview')).toContainText('Je pense jouer ce soir.');
  await sendText(page, 'Finalement, je vais peut-être faire autre chose.');
  const reply = page.getByTestId('message').filter({ hasText: 'Finalement, je vais' });
  await expect(reply.getByTestId('quote')).toContainText('Je pense jouer ce soir.');
  await expect(page.getByTestId('reply-preview')).toHaveCount(0);

  // Emma me répond (simulation locale, délais du mode démo).
  await expect(page.locator('[data-testid=message][data-author=character]').first()).toBeVisible({ timeout: 15_000 });

  // Lucas : un message, puis Emma m'écrit pendant ce temps.
  await row(page, 'Lucas').click();
  await expect(page).toHaveURL(new RegExp(`/chats/${lucas.conversationId}$`));
  await sendText(page, 'Yo Lucas, tu as vu le nouveau jeu ?');
  await page.waitForTimeout(2500); // laisse Lucas répondre
  const emmaBefore = await page.request.get(`/api/conversations/${emma.conversationId}/messages`).then((r) => r.json());
  await triggerIncoming(page.request, emma.characterId);

  // Une notification apparaît ; je reste chez Lucas, le compteur d'Emma augmente.
  await expect(page.getByTestId('toast').filter({ hasText: 'Emma Laurent' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/chats/${lucas.conversationId}$`));
  await expect(page.getByTestId('chat-title')).toHaveText('Lucas Martin');
  await expect(row(page, 'Emma').getByTestId('unread-badge')).toHaveText('1');
  await sendText(page, 'Je continue avec toi Lucas');

  // Sarah : je lui réponds.
  await row(page, 'Sarah').click();
  await expect(page.getByTestId('chat-title')).toHaveText('Sarah Benali');
  await sendText(page, 'Coucou Sarah, comment vas-tu ?');

  // Retour sur Emma : tout l'historique est là, plus le nouveau message.
  await row(page, 'Emma').click();
  for (const text of ['Salut Emma !', "J'ai une question.", 'Je pense jouer ce soir.', 'Finalement, je vais peut-être faire autre chose.']) {
    await expect(page.getByTestId('message-text').getByText(text, { exact: true })).toHaveCount(1);
  }
  await expect(page.locator('[data-testid=message][data-author=character]')).toHaveCount(emmaBefore.messages.filter((m: { authorType: string }) => m.authorType === 'character').length + 1);
  await expect(row(page, 'Emma').getByTestId('unread-badge')).toHaveCount(0);

  // Boîte mail : les messages entrants sont là.
  await page.goto('/mail/inbox');
  await expect(page.getByTestId('mail-item').first()).toBeVisible();
  const inbox = await page.request.get('/api/mailbox?view=inbox').then((r) => r.json());
  expect(inbox.items.some((i: { characterId: string }) => i.characterId === emma.characterId)).toBe(true);

  // IA : réponse après deux minutes (10 s en mode démo) pendant que je parle à Lucas.
  const patch = await page.request.patch(`/api/characters/${emma.characterId}`, {
    headers: HEADERS,
    data: { ai: { mode: 'auto', delaySeconds: 120 }, automation: { replyEnabled: false } },
  });
  expect(patch.ok()).toBeTruthy();
  await page.goto(`/chats/${lucas.conversationId}`);
  await triggerIncoming(page.request, emma.characterId);
  await expect(page.getByTestId('toast').filter({ hasText: 'Emma Laurent' })).toBeVisible();
  await expect(row(page, 'Emma')).toContainText('IA :', { timeout: 25_000 });
  await expect(page).toHaveURL(new RegExp(`/chats/${lucas.conversationId}$`));
  await expect(page.getByTestId('chat-title')).toHaveText('Lucas Martin');
  const emmaAfter = await page.request.get(`/api/conversations/${emma.conversationId}/messages?limit=200`).then((r) => r.json());
  expect(emmaAfter.messages.filter((m: { origin: string }) => m.origin === 'ai_auto')).toHaveLength(1);

  // Priorité manuelle : je réponds avant l'échéance, aucune réponse IA concurrente.
  await triggerIncoming(page.request, emma.characterId);
  await row(page, 'Emma').click();
  await sendText(page, 'Je réponds moi-même, avant l’IA');
  await page.waitForTimeout(12_000);
  const final = await page.request.get(`/api/conversations/${emma.conversationId}/messages?limit=200`).then((r) => r.json());
  expect(final.messages.filter((m: { origin: string }) => m.origin === 'ai_auto')).toHaveLength(1);

  // Je ferme puis rouvre le site : conversations et paramètres persistés.
  await page.reload();
  await expect(page.getByTestId('chat-title')).toHaveText('Emma Laurent');
  await expect(page.getByTestId('message').filter({ hasText: 'Je réponds moi-même' })).toHaveCount(1);
  const settings = await page.request.get(`/api/characters/${emma.characterId}`).then((r) => r.json());
  expect(settings.character.ai).toMatchObject({ mode: 'auto', delaySeconds: 120 });
});

test('Test 5 — brouillons indépendants dans l’interface, conservés après rechargement', async ({ page }) => {
  await openApp(page);
  await row(page, 'Emma').click();
  await page.getByTestId('composer').fill('Je voulais justement te demander si...');
  await row(page, 'Lucas').click();
  await expect(page.getByTestId('composer')).toHaveValue('');
  await page.getByTestId('composer').fill('Tu as vu le nouveau jeu ?');
  await expect(row(page, 'Emma')).toContainText('Brouillon : Je voulais justement');
  await row(page, 'Emma').click();
  await expect(page.getByTestId('composer')).toHaveValue('Je voulais justement te demander si...');
  await row(page, 'Lucas').click();
  await expect(page.getByTestId('composer')).toHaveValue('Tu as vu le nouveau jeu ?');
  await page.waitForTimeout(900); // sauvegarde serveur différée
  await page.reload();
  await expect(page.getByTestId('composer')).toHaveValue('Tu as vu le nouveau jeu ?');
  await row(page, 'Emma').click();
  await expect(page.getByTestId('composer')).toHaveValue('Je voulais justement te demander si...');
});

test('une notification ouvre la bonne conversation', async ({ page }) => {
  const who = await ids(page.request);
  await openApp(page);
  await triggerIncoming(page.request, who('Sarah').characterId);
  await triggerIncoming(page.request, who('Chloé').characterId);
  await page.goto('/notifications');
  await page.locator(`[data-testid=notification][data-conversation-id="${who('Sarah').conversationId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/chats/${who('Sarah').conversationId}`));
  await expect(page.getByTestId('chat-title')).toHaveText('Sarah Benali');
  await page.goto('/notifications');
  await page.locator(`[data-testid=notification][data-conversation-id="${who('Chloé').conversationId}"]`).click();
  await expect(page.getByTestId('chat-title')).toHaveText('Chloé Dubois');
});

test('boîte mail : lecture persistante et « Répondre dans la conversation »', async ({ page }) => {
  const who = await ids(page.request);
  await openApp(page);
  await triggerIncoming(page.request, who('Sarah').characterId);
  await page.goto('/mail/unread');
  const item = page.getByTestId('mail-item').first();
  await expect(item).toHaveAttribute('data-unread', 'true');
  await item.click();
  await expect(page.getByTestId('mail-detail')).toBeVisible();
  await page.reload();
  await page.goto('/mail/read');
  await expect(page.getByTestId('mail-item')).toHaveCount(1);
  await page.getByTestId('mail-item').first().click();
  await page.getByTestId('reply-in-conversation').click();
  await expect(page.getByTestId('chat-title')).toHaveText('Sarah Benali');
});
