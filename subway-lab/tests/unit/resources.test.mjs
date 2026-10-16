import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceTestManager, parseAmount, parseResourceSettings, MAX_RESOURCE } from '../../src/resources/ResourceTestManager.js';
import { PurchaseSimulator, reviveCost, CATALOG, parseProfile } from '../../src/resources/PurchaseSimulator.js';
import { SaveManager } from '../../src/storage/SaveManager.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';

function setup(storage = new MemoryStorage()) {
  const sm = new SaveManager(storage);
  const res = new ResourceTestManager(sm);
  res.load();
  const shop = new PurchaseSimulator(sm, res);
  shop.load();
  return { storage, sm, res, shop };
}

test('Mode normal : portefeuille alimenté par les gains, achats refusés si insuffisant', () => {
  const { res } = setup();
  assert.equal(res.balance('coins'), 0);
  assert.equal(res.spend({ coins: 1 }).ok, false);
  res.earn({ coins: 120, keys: 2 });
  assert.equal(res.spend({ coins: 100, keys: 1 }).ok, true);
  assert.equal(res.balance('coins'), 20);
  assert.equal(res.balance('keys'), 1);
  const r = res.spend({ coins: 10, keys: 5 });
  assert.equal(r.ok, false);
  assert.equal(res.balance('coins'), 20, 'débit atomique : rien n\'est débité en cas de refus');
});

test('Mode illimité : pièces, clés, les deux ; achats sans effet sur le mode ni le solde', () => {
  const { res, shop } = setup();
  res.enableUnlimited('coins');
  assert.equal(res.balance('coins'), Infinity);
  assert.equal(res.mode('keys'), 'NORMAL');
  res.enableUnlimited('keys');
  for (let i = 0; i < 5000; i++) assert.equal(res.spend({ coins: 1e6, keys: 1000 }, { persist: false }).ok, true);
  assert.equal(res.mode('coins'), 'UNLIMITED');
  assert.equal(res.mode('keys'), 'UNLIMITED');
  for (const item of CATALOG) shop.buy(item.id);
  assert.equal(res.mode('coins'), 'UNLIMITED', 'un achat ne désactive jamais l\'illimité');
  assert.equal(res.balance('keys'), Infinity);
});

test('Désactivation : retour au mode précédent ; retour au normal ; réinitialisation', () => {
  const { res } = setup();
  res.setCustom('coins', 500);
  res.enableUnlimited('both');
  res.disableUnlimited();
  assert.equal(res.mode('coins'), 'CUSTOM');
  assert.equal(res.balance('coins'), 500);
  assert.equal(res.mode('keys'), 'NORMAL');
  res.returnToNormal();
  assert.equal(res.mode('coins'), 'NORMAL');
  res.earn({ coins: 30 });
  res.resetResources();
  assert.equal(res.balance('coins'), 0);
  assert.equal(res.settings.coins.custom, 0);
});

test('Quantité personnalisée : validation stricte des saisies', () => {
  const { res } = setup();
  assert.equal(res.setCustom('keys', '1 000'), 1000);
  for (const bad of ['-5', '12.5', 'abc', '', '1e3', -1, 1.5, NaN, Infinity, MAX_RESOURCE + 1, null]) {
    assert.throws(() => parseAmount(bad), undefined, `valeur refusée : ${String(bad)}`);
  }
  assert.equal(res.settings.keys.custom, 1000, 'une saisie invalide ne modifie rien');
  assert.throws(() => res.setMode(/** @type {any} */ ('coins'), /** @type {any} */ ('GOD')));
});

test('Cohérence après des milliers d\'opérations (mode personnalisé)', () => {
  const { res } = setup();
  res.setCustom('coins', 100000);
  res.setCustom('keys', 3000);
  let ok = 0;
  for (let i = 0; i < 10000; i++) if (res.spend({ coins: 7, keys: 1 }, { persist: false }).ok) ok++;
  assert.equal(ok, 3000);
  assert.equal(res.balance('coins'), 100000 - 7 * 3000);
  assert.equal(res.balance('keys'), 0);
  assert.ok(res.balance('coins') >= 0);
});

test('Persistance : mode, quantité, date et version rechargés ; valeurs invalides rejetées', () => {
  const storage = new MemoryStorage();
  const a = setup(storage);
  a.res.enableUnlimited('keys');
  a.res.setCustom('coins', 4242);
  const b = setup(storage);
  assert.equal(b.res.mode('keys'), 'UNLIMITED');
  assert.equal(b.res.balance('coins'), 4242);
  assert.equal(b.res.settings.version, 2);
  assert.ok(Date.parse(b.res.settings.updatedAt) > 0);
  // Fichier altéré : valeurs négatives → repli sur la sauvegarde précédente, jamais de valeur invalide.
  const raw = JSON.parse(storage.getItem('sslab:resources'));
  raw.coins.custom = -50;
  storage.setItem('sslab:resources', JSON.stringify(raw));
  const c = setup(storage);
  assert.ok(c.res.balance('coins') >= 0);
  assert.ok(c.res.loadWarning);
});

test('Migration des paramètres v1 → v2', () => {
  const v2 = parseResourceSettings({ version: 1, mode: 'unlimited', customCoins: 10, customKeys: 3, coins: 7, keys: 1 });
  assert.equal(v2.version, 2);
  assert.equal(v2.coins.mode, 'UNLIMITED');
  assert.equal(v2.keys.custom, 3);
  assert.equal(v2.wallet.coins, 7);
  assert.throws(() => parseResourceSettings({ version: 3 }));
});

test('Boutique : améliorations, bonus de départ, personnages, résurrection', () => {
  const { res, shop } = setup();
  res.setCustom('coins', 2000);
  assert.equal(shop.buy('UPGRADE_MAGNET').ok, true);
  assert.equal(res.balance('coins'), 1500);
  assert.equal(shop.profile.upgrades.MAGNET, 1);
  assert.equal(shop.buy('START_MAGNET').ok, true);
  const cfg = shop.consumeRunConfig();
  assert.equal(cfg.startBonus, 'MAGNET');
  assert.equal(cfg.upgrades.MAGNET, 1);
  assert.equal(shop.consumeRunConfig().startBonus, null, 'bonus consommé');
  assert.equal(shop.buy('CHAR_GOLD').ok, false);
  res.enableUnlimited('both');
  assert.equal(shop.buy('CHAR_GOLD').ok, true);
  assert.equal(shop.buy('CHAR_GOLD').ok, false, 'déjà débloqué');
  shop.equip('GOLD');
  assert.equal(shop.consumeRunConfig().skin, 'GOLD');
  assert.throws(() => shop.equip('NINJA'));
  assert.deepEqual([0, 1, 2, 3].map((n) => reviveCost(n).keys), [1, 2, 4, 8]);
  for (let i = 0; i < 10; i++) shop.buy('UPGRADE_DOUBLE');
  assert.equal(shop.profile.upgrades.DOUBLE, 5, 'niveau plafonné');
});

test('Boutique : hoverboards, multiplicateur payé en clés, boîte mystère, inventaire figé', () => {
  const { res, shop } = setup();
  res.setCustom('coins', 1500);
  res.setCustom('keys', 10);
  assert.equal(shop.buy('HOVERBOARD_5').ok, true);
  assert.equal(shop.buy('HOVERBOARD_1').ok, true);
  assert.equal(shop.profile.hoverboards, 6);
  assert.equal(shop.buy('MULTIPLIER').ok, true); // 3 clés
  assert.equal(shop.buy('MULTIPLIER').ok, true); // 6 clés
  assert.equal(shop.buy('MULTIPLIER').ok, false, 'clés insuffisantes');
  assert.equal(res.balance('keys'), 1);
  const cfg = shop.consumeRunConfig();
  assert.equal(cfg.hoverboards, 6);
  assert.equal(cfg.scoreMultiplier, 3);
  shop.useHoverboards(2);
  assert.equal(shop.profile.hoverboards, 4);
  // Boîte mystère : tirage injectable.
  const draws = [0.1, 0.5];
  shop.random = () => draws.shift() ?? 0;
  res.setCustom('coins', 500);
  const box = shop.buy('MYSTERY_BOX');
  assert.equal(box.ok, true);
  assert.deepEqual(box.reward, { kind: 'COINS', amount: 600 });
  assert.equal(res.balance('coins'), 600);
});

test('Profil : migration v1 → v2 (tenues → personnages)', () => {
  const p = parseProfile({ version: 1, upgrades: { MAGNET: 2, DOUBLE: 0, SNEAKERS: 1 }, startMagnets: 3, skins: ['DEFAULT', 'NEON'], equippedSkin: 'NEON' });
  assert.equal(p.version, 2);
  assert.deepEqual(p.characters, ['DEFAULT', 'NEON']);
  assert.equal(p.equippedCharacter, 'NEON');
  assert.equal(p.upgrades.JETPACK, 0);
  assert.equal(p.hoverboards, 0);
  assert.throws(() => parseProfile({ ...p, characters: ['HACKER'] }));
});
