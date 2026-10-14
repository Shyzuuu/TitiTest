/**
 * Personnages ORIGINAUX du prototype (aucun personnage de Subway Surfers n'est reproduit).
 * Les identifiants DEFAULT / NEON / GOLD sont conservés pour la compatibilité des anciennes runs.
 */

/**
 * @typedef {{ id: string, name: string, cost: { coins: number, keys: number },
 *   colors: { body: string, legs: string, head: string, hair: string, accent: string },
 *   accessory: 'cap' | 'hood' | 'antenna' | 'crest' | 'band' | 'crown' }} Character
 */

/** @type {readonly Character[]} */
export const CHARACTERS = Object.freeze([
  { id: 'DEFAULT', name: 'Rio', cost: { coins: 0, keys: 0 }, colors: { body: '#ff8a3d', legs: '#2f4a7a', head: '#f2c39b', hair: '#3b2a1e', accent: '#2e86de' }, accessory: 'cap' },
  { id: 'NEON', name: 'Néa', cost: { coins: 1500, keys: 0 }, colors: { body: '#2de1a0', legs: '#1d1d3a', head: '#f6d2b4', hair: '#ff2fd0', accent: '#ff2fd0' }, accessory: 'band' },
  { id: 'PUNK', name: 'Zia', cost: { coins: 0, keys: 30 }, colors: { body: '#1f1f24', legs: '#5c2a7a', head: '#e8b48f', hair: '#e5484d', accent: '#e5484d' }, accessory: 'crest' },
  { id: 'NINJA', name: 'Kage', cost: { coins: 12000, keys: 0 }, colors: { body: '#2a2f3a', legs: '#20242c', head: '#d9a57a', hair: '#20242c', accent: '#c0392b' }, accessory: 'hood' },
  { id: 'ROBOT', name: 'Boulon', cost: { coins: 20000, keys: 10 }, colors: { body: '#9aa7b8', legs: '#59677a', head: '#c9d3df', hair: '#59677a', accent: '#4fc3f7' }, accessory: 'antenna' },
  { id: 'GOLD', name: 'Aurum', cost: { coins: 50000, keys: 25 }, colors: { body: '#f4c542', legs: '#8a6d00', head: '#ffe0b3', hair: '#8a6d00', accent: '#fff3c4' }, accessory: 'crown' },
]);

export const CHARACTER_IDS = Object.freeze(CHARACTERS.map((c) => c.id));

/** @param {string} id */
export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
