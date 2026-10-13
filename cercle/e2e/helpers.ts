import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const HEADERS = { 'X-Requested-With': 'cercle' };

interface Character {
  id: string;
  firstName: string;
}
interface Conversation {
  id: string;
  characterId: string;
}

export async function apiLogin(request: APIRequestContext) {
  const res = await request.post('/api/auth/login', { headers: HEADERS, data: { username: 'moi', password: 'e2e-password' } });
  expect(res.ok()).toBeTruthy();
}

/** Remet la démonstration à zéro et coupe les messages spontanés pour un scénario déterministe. */
export async function resetWorld(request: APIRequestContext) {
  await apiLogin(request);
  const reset = await request.post('/api/admin/reset', { headers: { ...HEADERS, 'X-Confirm': 'RESET_DEMO' }, data: {} });
  expect(reset.ok()).toBeTruthy();
  const { characters } = (await (await request.get('/api/characters')).json()) as { characters: Character[] };
  for (const c of characters) {
    const r = await request.patch(`/api/characters/${c.id}`, { headers: HEADERS, data: { automation: { incomingEnabled: false } } });
    expect(r.ok()).toBeTruthy();
  }
}

export async function ids(request: APIRequestContext) {
  const { characters } = (await (await request.get('/api/characters')).json()) as { characters: Character[] };
  const { conversations } = (await (await request.get('/api/conversations')).json()) as { conversations: Conversation[] };
  const byName = (n: string) => {
    const ch = characters.find((c) => c.firstName === n)!;
    return { characterId: ch.id, conversationId: conversations.find((c) => c.characterId === ch.id)!.id };
  };
  return byName;
}

export async function triggerIncoming(request: APIRequestContext, characterId: string) {
  const r = await request.post('/api/admin/simulate/incoming', { headers: HEADERS, data: { characterId } });
  expect(r.ok()).toBeTruthy();
}

export async function openApp(page: Page) {
  await page.goto('/chats');
  await expect(page.getByTestId('conversation-row').first()).toBeVisible();
}

export function row(page: Page, name: string) {
  return page.locator(`[data-testid=conversation-row][data-character-name="${name}"]`);
}

export async function sendText(page: Page, text: string) {
  await page.getByTestId('composer').fill(text);
  await page.getByTestId('send-button').click();
  await expect(page.getByTestId('message').filter({ hasText: text }).last()).toBeVisible();
}
